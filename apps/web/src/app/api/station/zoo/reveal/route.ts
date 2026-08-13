import { auth } from "@/auth"
import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body } from "@/segel/guard"
import { ZOO_PROFILES, zooTrio } from "@/segel/router"
import { fileEntry, markStation } from "@/segel/store"

/**
 * The reveal, and the only place the letters are mapped to names.
 *
 * It requires her ranking in the same request that hands back the identities,
 * so there is no order of calls in which the browser learns who is who first.
 * That is the whole mechanic of the station enforced at the wire rather than
 * in the UI, where a curious ten-year-old with a devtools window could
 * otherwise undo it.
 *
 * No model call, so it needs no cap check — but it still needs a session.
 */

type Body = {
  voyageId?: string
  stationId?: string
  round?: number
  /** Letters, best first. */
  ranking?: string[]
  why?: string
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 })

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")
  if (!input.ranking?.length) return badRequest("Sortiere erst die Antworten.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station || station.type !== "zoo")
    return badRequest("Diese Station gibt es nicht.")

  const trio = zooTrio(Math.max(0, Math.floor(input.round ?? 0)))
  const letters = ["A", "B", "C"]

  const revealed = input.ranking.map((letter, place) => {
    const model = trio[letters.indexOf(letter)] ?? ""
    const profile = ZOO_PROFILES[model]
    return {
      place: place + 1,
      letter,
      model,
      name: profile?.name ?? model,
      origin: profile?.origin ?? "unbekannt",
      size: profile?.size ?? "unbekannt",
    }
  })

  await fileEntry({
    kind: "ranking",
    voyageId: voyage.id,
    stationId: station.id,
    title: `Modelle sortiert: ${revealed.map((entry) => entry.name).join(" vor ")}`,
    ...(input.why ? { why: input.why } : {}),
    payload: { round: input.round ?? 0, revealed },
  })

  await markStation(voyage.id, station.id, { complete: true, score: revealed.length })

  return Response.json({ revealed })
}
