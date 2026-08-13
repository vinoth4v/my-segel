import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  addArtifactVersion,
  artifactById,
  createArtifact,
  recordEscalation,
  runById,
  versionsOf,
} from "@/db/segel"
import { checkArtifact, iterationPrompt, WERKSTATT_SYSTEM_PROMPT } from "@/lib/artifact"
import { callStation } from "@/lib/gateway"
import { gate } from "@/lib/limits"
import { route } from "@/lib/router"
import { checkInput, MAX_INPUT_CHARS, tooLong } from "@/lib/safety"

const schema = z.object({
  runId: z.uuid(),
  /** Absent on the first build, present on every iteration after. */
  artifactId: z.uuid().optional(),
  request: z.string().min(1).max(MAX_INPUT_CHARS),
})

/**
 * Builds or changes one artifact.
 *
 * This is the station with the highest chance of an embarrassing failure: free
 * code models return something unrenderable often enough that "call the model
 * and show the answer" produces a blank frame several times in ten, and a
 * blank frame in front of a ten-year-old who just described her idea is a
 * failed session, not a retry.
 *
 * So the reply is verified before it is accepted — `checkArtifact` is passed
 * to the gateway as its `accept` predicate, which means an unrenderable answer
 * counts as a failed call and moves to the next model exactly like a timeout
 * would. Only after two free attempts does it reach the paid one, and that is
 * recorded so the deck can show what it cost.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ kind: "error", message: "Ungültige Anfrage." }, { status: 400 })
  }

  const open = await gate()
  if (!open.open) return NextResponse.json({ kind: "held", message: open.message })

  const run = await runById(parsed.data.runId)
  if (!run) {
    return NextResponse.json({ kind: "error", message: "Diese Station kenne ich nicht." })
  }

  const wish = parsed.data.request
  if (tooLong(wish)) {
    return NextResponse.json({ kind: "held", message: "Das ist zu lang. Sag es kürzer." })
  }

  const verdict = checkInput(wish)
  if (!verdict.allowed) {
    return NextResponse.json({ kind: "held", message: verdict.message })
  }

  // An iteration gets the current file back so the model edits rather than
  // starts over — which is what makes "mach die Knöpfe orange" keep the timer
  // she added two versions ago.
  let previousHtml: string | null = null
  if (parsed.data.artifactId) {
    const owned = await artifactById(parsed.data.artifactId)
    if (!owned) {
      return NextResponse.json({ kind: "error", message: "Das Werkstück kenne ich nicht." })
    }
    const versions = await versionsOf(owned.id)
    previousHtml = versions[versions.length - 1]?.html ?? null
  }

  const chosen = route("werkstatt")
  const prompt = previousHtml ? iterationPrompt(previousHtml, wish) : wish

  const result = await callStation({
    station: "werkstatt",
    route: chosen,
    system: WERKSTATT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    accept: (text) => checkArtifact(text).ok,
  })

  if (!result.ok) {
    console.error("werkstatt failed", result.detail)
    return NextResponse.json({
      kind: "error",
      message: "Das hat nicht geklappt. Beschreib es nochmal, gern etwas anders.",
    })
  }

  const checked = checkArtifact(result.text)
  if (!checked.ok) {
    // Unreachable while `accept` is the same predicate, and kept because the
    // day someone loosens one of the two, this is what stops a blank frame.
    return NextResponse.json({
      kind: "error",
      message: "Das hat nicht geklappt. Beschreib es nochmal, gern etwas anders.",
    })
  }

  if (result.escalated) {
    await recordEscalation({
      station: "werkstatt",
      fromModel: chosen.model,
      toModel: result.servedBy,
      reason: "free models produced nothing renderable",
    })
  }

  const artifactId = parsed.data.artifactId ?? (await createArtifact(titleFrom(wish)))
  const version = await addArtifactVersion({
    artifactId,
    prompt: wish,
    html: checked.html,
    escalated: result.escalated,
    servedBy: result.servedBy,
  })

  return NextResponse.json({ kind: "built", artifactId, version, escalated: result.escalated })
}

/** Her own words, trimmed to a title — never a model call for something this small. */
function titleFrom(wish: string): string {
  const firstLine = wish.split("\n")[0]?.trim() ?? "Werkstück"
  return firstLine.length > 60 ? `${firstLine.slice(0, 60).trimEnd()}…` : firstLine
}
