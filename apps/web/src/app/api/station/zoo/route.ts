import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body, guard } from "@/segel/guard"
import { callStation, zooTrio } from "@/segel/router"
import { checkInput, checkOutput, systemFor } from "@/segel/safety"
import { recordTurn } from "@/segel/store"
import { LETTER_TAG } from "@/segel/zoo"

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
    trio.map((lane) =>
      callStation("zoo", [{ role: "user", content: verdict.text }], {
        system,
        overrideLane: lane,
      }),
    ),
  )

  const letters = ["A", "B", "C"]
  const answers = await Promise.all(
    settled.map(async (result, index) => {
      const letter = letters[index] ?? String(index)
      const lane = trio[index] ?? ""

      if (result.status === "rejected") {
        await recordTurn({
          voyageId: voyage.id,
          stationId: station.id,
          stationType: "zoo",
          role: "modell",
          content: `${LETTER_TAG}${letter} keine Antwort: ${String(result.reason).slice(0, 200)}`,
        })
        return { letter, text: "", failed: true }
      }

      const output = checkOutput(result.value.text)

      // The letter is written into the row so the reveal can pair it with the
      // `servedBy` this same row records. That pairing is the only place the
      // mapping exists — deliberately server-side, so the browser cannot read
      // it before she has committed to a ranking.
      await recordTurn({
        voyageId: voyage.id,
        stationId: station.id,
        stationType: "zoo",
        role: "modell",
        content: `${LETTER_TAG}${letter} ${output.text}`,
        call: { ...result.value.call, model: lane },
        flagged: !output.ok,
      })

      return { letter, text: output.text, failed: false }
    }),
  )

  return Response.json({ question: verdict.text, answers, round: input.round ?? 0 })
}
