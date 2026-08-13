import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body, guard } from "@/segel/guard"
import { callStation, zooTrio } from "@/segel/router"
import { checkInput, checkOutput, systemFor } from "@/segel/safety"
import { recordTurn } from "@/segel/store"

/**
 * Der Modell-Zoo: one question, three models, labelled A, B and C.
 *
 * The three run concurrently and are settled with allSettled rather than
 * all, because the acceptance condition for this station is explicitly that
 * one model timing out must not block the other two. A missing answer is
 * shown as missing — which is itself true and worth her seeing, since free
 * models really do fall over.
 *
 * Which model is behind which letter never reaches the browser until she has
 * ranked them. That is not decoration: a blind ranking she can peek at is
 * not a ranking, it is brand recognition.
 */

type Body = { voyageId?: string; stationId?: string; question?: string; round?: number }

export async function POST(request: Request) {
  const gate = await guard()
  if (gate.blocked) return gate.response

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station || station.type !== "zoo")
    return badRequest("Diese Station gibt es nicht.")

  const asked = input.question?.trim() || station.question
  const verdict = checkInput(asked)
  if (!verdict.ok) return Response.json({ refused: verdict.reason, message: verdict.message })

  const trio = zooTrio(Math.max(0, Math.floor(input.round ?? 0)))
  const system = systemFor("zoo", station.scaffold)

  await recordTurn({
    voyageId: voyage.id,
    stationId: station.id,
    stationType: "zoo",
    role: "kind",
    content: verdict.text,
  })

  const settled = await Promise.allSettled(
    trio.map((model) =>
      callStation("zoo", [{ role: "user", content: verdict.text }], {
        system,
        overrideModel: model,
      }),
    ),
  )

  const letters = ["A", "B", "C"]
  const answers = await Promise.all(
    settled.map(async (result, index) => {
      const letter = letters[index] ?? String(index)
      const model = trio[index] ?? ""

      if (result.status === "rejected") {
        await recordTurn({
          voyageId: voyage.id,
          stationId: station.id,
          stationType: "zoo",
          role: "modell",
          content: `[${letter}] keine Antwort: ${String(result.reason).slice(0, 200)}`,
        })
        return { letter, text: "", failed: true }
      }

      const output = checkOutput(result.value.text)
      await recordTurn({
        voyageId: voyage.id,
        stationId: station.id,
        stationType: "zoo",
        role: "modell",
        content: `[${letter}] ${output.text}`,
        call: { ...result.value.call, model },
        flagged: !output.ok,
      })

      return { letter, text: output.text, failed: false }
    }),
  )

  // `trio` is returned so the client can ask for the reveal, but the client
  // is not told which letter maps to which model until it posts a ranking.
  return Response.json({ question: verdict.text, answers, round: input.round ?? 0 })
}
