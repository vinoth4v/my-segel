import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addMessage, runById } from "@/db/segel"
import { fanOut } from "@/lib/gateway"
import { gate } from "@/lib/limits"
import { laborRoute, type Route } from "@/lib/router"
import { BASE_SYSTEM_PROMPT, checkInput, checkOutput, MAX_INPUT_CHARS, tooLong } from "@/lib/safety"

const schema = z.object({
  runId: z.uuid(),
  draft: z.string().min(1).max(MAX_INPUT_CHARS),
  assembled: z.string().min(1).max(MAX_INPUT_CHARS * 2),
})

/**
 * Both halves of the prompt lab, on one model.
 *
 * The most important line in this file is `laborRoute()` being called once and
 * the result used for both sides. If the two halves ran on different models
 * the comparison would measure the models rather than the prompts, and she
 * would draw a confident, wrong conclusion from a real-looking result — worse
 * than the station not working at all.
 *
 * The two calls go out together so the pair comes back in the time of the
 * slower one, and a failure on one side still renders the other.
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

  const { draft, assembled } = parsed.data
  if (tooLong(draft)) {
    return NextResponse.json({ kind: "held", message: "Das ist zu lang. Fass es kürzer." })
  }

  for (const text of [draft, assembled]) {
    const verdict = checkInput(text)
    if (!verdict.allowed) {
      await addMessage({
        runId: run.id,
        role: "segler",
        content: text,
        blocked: true,
        blockReason: verdict.reason,
      })
      return NextResponse.json({ kind: "held", message: verdict.message })
    }
  }

  const shared = laborRoute()
  const [left, right] = await Promise.all([run1(shared, draft), run1(shared, assembled)])

  await addMessage({ runId: run.id, role: "segler", content: `[links] ${draft}` })
  await addMessage({ runId: run.id, role: "segler", content: `[rechts] ${assembled}` })
  await addMessage({
    runId: run.id,
    role: "schiff",
    content: `[links] ${left ?? "keine Antwort"}`,
    model: shared.model,
    blocked: left === null,
  })
  await addMessage({
    runId: run.id,
    role: "schiff",
    content: `[rechts] ${right ?? "keine Antwort"}`,
    model: shared.model,
    blocked: right === null,
  })

  return NextResponse.json({ kind: "answers", model: shared.model, left, right })
}

/** One prompt on the shared route, filtered, or null when it did not come back. */
async function run1(route: Route, prompt: string): Promise<string | null> {
  const [column] = await fanOut({
    routes: [route],
    system: BASE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  })

  if (!column?.text) return null

  const safe = checkOutput(column.text)
  return safe.safe ? column.text : safe.replacement
}
