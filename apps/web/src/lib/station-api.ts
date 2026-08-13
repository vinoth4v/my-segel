import { z } from "zod"
import type { Station } from "../content/schema.ts"
import { stationById, voyageBySlug } from "../content/voyages.ts"
import { addMessage, messagesFor, recordEscalation, runById } from "../db/segel.ts"
import type { Message } from "../kompass.ts"
import { callStation } from "./gateway.ts"
import { gate } from "./limits.ts"
import { route } from "./router.ts"
import { checkInput, checkOutput, MAX_INPUT_CHARS, systemPromptFor, tooLong } from "./safety.ts"

/**
 * The shared spine of every conversational station.
 *
 * `talk` and `jagd` are the same request with different routing and a
 * different brief, so they are the same code — which matters more than it
 * sounds: it means the safety filters, the caps and the transcript writes
 * cannot be present on one station and forgotten on the other.
 *
 * Everything here runs on the server. The gateway token never leaves it, and
 * neither does the decision about which model answers.
 */

export const turnSchema = z.object({
  runId: z.uuid(),
  text: z.string().min(1).max(MAX_INPUT_CHARS),
})

export type TurnResult =
  | { kind: "answer"; reply: string; servedBy: string; escalated: boolean }
  /** A cap, the kill switch, or a filter. She sees `message` and nothing else. */
  | { kind: "held"; message: string }
  | { kind: "error"; message: string }

/** How much of the conversation the model is given back. */
const CONTEXT_TURNS = 12

export async function takeTurn(input: {
  runId: string
  text: string
}): Promise<TurnResult> {
  const open = await gate()
  if (!open.open) return { kind: "held", message: open.message }

  const run = await runById(input.runId)
  if (!run) return { kind: "error", message: "Diese Station kenne ich nicht." }

  const voyage = voyageBySlug(run.voyageSlug)
  const station = voyage ? stationById(voyage, run.stationId) : undefined
  if (!station) return { kind: "error", message: "Diese Station kenne ich nicht." }

  if (tooLong(input.text)) {
    return { kind: "held", message: "Das ist zu lang. Fass es kürzer." }
  }

  // Written to the transcript before anything else happens, so a blocked turn
  // is still visible to the parent — the filter hides it from her, not them.
  const verdict = checkInput(input.text)
  if (!verdict.allowed) {
    await addMessage({
      runId: input.runId,
      role: "segler",
      content: input.text,
      blocked: true,
      blockReason: verdict.reason,
    })
    return { kind: "held", message: verdict.message }
  }

  await addMessage({ runId: input.runId, role: "segler", content: input.text })

  const history = await messagesFor(input.runId)
  const messages = toModelMessages(history, station)

  const chosen = route(station.type)
  const result = await callStation({
    station: station.type,
    route: chosen,
    system: systemPromptFor(station),
    messages,
  })

  if (!result.ok) {
    console.error(`station ${station.type} failed`, result.detail)
    return {
      kind: "error",
      message: "Das Modell antwortet gerade nicht. Versuch es gleich nochmal.",
    }
  }

  if (result.escalated) {
    await recordEscalation({
      station: station.type,
      fromModel: chosen.model,
      toModel: result.servedBy,
      reason: "free models failed",
    })
  }

  const safe = checkOutput(result.text)
  const shown = safe.safe ? result.text : safe.replacement

  await addMessage({
    runId: input.runId,
    role: "schiff",
    content: result.text,
    model: chosen.model,
    servedBy: result.servedBy,
    blocked: !safe.safe,
    blockReason: safe.safe ? undefined : safe.label,
  })

  return {
    kind: "answer",
    reply: shown,
    servedBy: result.servedBy,
    escalated: result.escalated,
  }
}

/**
 * The transcript, as the model sees it.
 *
 * Blocked turns are dropped rather than sent: the row exists for the parent,
 * and feeding a filtered message back as context would hand the model exactly
 * the personal data the filter just stopped. Trimmed to the last few turns
 * because there is no persistent memory in v1 by design, and a station's
 * context should not grow without bound inside one sitting either.
 */
function toModelMessages(
  history: Awaited<ReturnType<typeof messagesFor>>,
  station: Station,
): Message[] {
  const usable = history
    .filter((row) => !row.blocked)
    .slice(-CONTEXT_TURNS)
    .map((row) => ({
      role: row.role === "segler" ? ("user" as const) : ("assistant" as const),
      content: row.content,
    }))

  // The gateway requires the first message to be from the user. A run whose
  // history somehow starts with an assistant turn would 400 the whole station.
  while (usable.length > 0 && usable[0]?.role !== "user") usable.shift()

  if (usable.length === 0) {
    return [{ role: "user", content: `Erklär mir kurz, worum es bei "${station.title}" geht.` }]
  }

  return usable
}
