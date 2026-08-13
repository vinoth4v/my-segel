import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addMessage, runById } from "@/db/segel"
import { fanOut } from "@/lib/gateway"
import { gate } from "@/lib/limits"
import { zooRoutes } from "@/lib/router"
import { BASE_SYSTEM_PROMPT, checkInput, checkOutput, MAX_INPUT_CHARS, tooLong } from "@/lib/safety"

const schema = z.object({
  runId: z.uuid(),
  prompt: z.string().min(1).max(MAX_INPUT_CHARS),
})

/**
 * One prompt, three models, in parallel.
 *
 * The acceptance test is three columns rendered inside eight seconds with a
 * timeout on one not blocking the other two, which is why this is a single
 * fan-out with per-column deadlines rather than three requests from the
 * browser: three browser requests would each need their own auth, their own
 * cap check, and would let the client decide the line-up.
 *
 * The columns come back labelled A, B and C, and `servedBy` is withheld until
 * she has ranked them — the whole station is a blind test, and shipping the
 * model names in the first response would make the reveal a formality.
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

  const { prompt } = parsed.data
  if (tooLong(prompt)) {
    return NextResponse.json({ kind: "held", message: "Das ist zu lang. Fass es kürzer." })
  }

  const verdict = checkInput(prompt)
  if (!verdict.allowed) {
    await addMessage({
      runId: run.id,
      role: "segler",
      content: prompt,
      blocked: true,
      blockReason: verdict.reason,
    })
    return NextResponse.json({ kind: "held", message: verdict.message })
  }

  await addMessage({ runId: run.id, role: "segler", content: prompt })

  const columns = await fanOut({
    routes: zooRoutes(),
    system: BASE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  })

  const answers = await Promise.all(
    columns.map(async (column) => {
      if (!column.text) {
        await addMessage({
          runId: run.id,
          role: "schiff",
          content: `[${column.label}] keine Antwort`,
          model: column.servedBy,
          blocked: true,
          blockReason: "timeout or error",
        })
        return { label: column.label, text: null, failed: true }
      }

      const safe = checkOutput(column.text)
      await addMessage({
        runId: run.id,
        role: "schiff",
        content: column.text,
        model: column.servedBy,
        servedBy: column.servedBy,
        blocked: !safe.safe,
        blockReason: safe.safe ? undefined : safe.label,
      })

      return {
        label: column.label,
        text: safe.safe ? column.text : safe.replacement,
        failed: false,
      }
    }),
  )

  // The names ride along in a separate field that the client does not render
  // until she has committed to a ranking. Worth being plain about what that
  // is: a blind at the UI level, not a sealed envelope — the names are in the
  // payload and devtools would show them. Holding them back until the ranking
  // is submitted would cost a round trip at the one moment in the station that
  // should feel instant, and the failure it would prevent is a child choosing
  // to cheat at a game whose only prize is her own opinion.
  return NextResponse.json({
    kind: "answers",
    answers,
    reveal: columns.map((column) => ({ label: column.label, servedBy: column.servedBy })),
  })
}
