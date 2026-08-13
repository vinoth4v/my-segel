import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body, guard } from "@/segel/guard"
import { callStation, describeModel, route } from "@/segel/router"
import { checkInput, checkOutput, systemFor } from "@/segel/safety"
import { recordTurn } from "@/segel/store"

/**
 * Prompt-Labor: her prompt and the stronger one, side by side.
 *
 * Both halves run on the same pinned model, in one request, and that is the
 * single most important line in this file. If the two sides could land on
 * different models the station would silently measure the model rather than
 * her prompt, and she would learn the wrong lesson from a comparison that
 * looked right. Passing the pin explicitly to both calls means a change to
 * the routing table cannot break the invariant by accident.
 */

type Body = {
  voyageId?: string
  stationId?: string
  weak?: string
  strong?: string
}

export async function POST(request: Request) {
  const gate = await guard()
  if (gate.blocked) return gate.response

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station || station.type !== "labor") {
    return badRequest("Diese Station gibt es nicht.")
  }

  const weak = checkInput(input.weak ?? "")
  const strong = checkInput(input.strong ?? "")
  if (!weak.ok) return Response.json({ refused: weak.reason, message: weak.message, side: "links" })
  if (!strong.ok) {
    return Response.json({ refused: strong.reason, message: strong.message, side: "rechts" })
  }

  const system = systemFor("labor", station.scaffold)
  // One lane, named once and passed to both calls. The station is only a
  // valid comparison if both halves meet the same model, and `route("labor")`
  // never retries on another lane for the same reason.
  const lane = route("labor").lane

  const [left, right] = await Promise.all([
    callStation("labor", [{ role: "user", content: weak.text }], {
      system,
      overrideLane: lane,
    }),
    callStation("labor", [{ role: "user", content: strong.text }], {
      system,
      overrideLane: lane,
    }),
  ])

  const leftOut = checkOutput(left.text)
  const rightOut = checkOutput(right.text)

  for (const [side, prompt, reply, output] of [
    ["links", weak.text, left, leftOut],
    ["rechts", strong.text, right, rightOut],
  ] as const) {
    await recordTurn({
      voyageId: voyage.id,
      stationId: station.id,
      stationType: "labor",
      role: "kind",
      content: `[${side}] ${prompt}`,
    })
    await recordTurn({
      voyageId: voyage.id,
      stationId: station.id,
      stationType: "labor",
      role: "modell",
      content: `[${side}] ${output.text}`,
      call: reply.call,
      flagged: !output.ok,
    })
  }

  // Verified, not asserted. Both halves ask for the same lane, but a lane is
  // a chain — if one call fell through to a different model, the comparison
  // is measuring the model rather than her prompt and the station is lying.
  // Cheap to check now that the gateway reports what actually answered.
  const sameModel = left.call.servedBy === right.call.servedBy

  return Response.json({
    left: leftOut.text,
    right: rightOut.text,
    // Shown to her on purpose: proof the comparison was fair, and one more
    // reminder that a model has a name.
    model: describeModel(left.call.servedBy).name,
    sameModel,
  })
}
