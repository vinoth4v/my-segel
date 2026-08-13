import { auth } from "@/auth"
import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body } from "@/segel/guard"
import { fileEntry, markStation, zooRows } from "@/segel/store"
import { distinctModelCount, pairLettersToModels, type RevealedModel } from "@/segel/zoo"

/**
 * The reveal, and the only place the letters are mapped to names.
 *
 * It requires her ranking in the same request that hands back the identities,
 * so there is no order of calls in which the browser learns who is who first.
 * That is the whole mechanic of the station enforced at the wire rather than
 * in the UI, where a curious ten-year-old with a devtools window could
 * otherwise undo it.
 *
 * The names come from the transcript rows the round wrote, each carrying the
 * gateway's own `x-kompass-served-by`. Nothing here decides what a model was;
 * it only reports what answered.
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

  const rows = await zooRows(voyage.id, station.id)
  const paired = pairLettersToModels(rows)

  const revealed: RevealedModel[] = []
  const ranked = input.ranking.map((letter, place) => {
    const found = paired.get(letter)
    if (found) revealed.push(found)
    return {
      place: place + 1,
      letter,
      name: found?.name ?? "unbekannt",
      origin: found?.origin ?? "unbekannt",
      size: found?.size ?? "unbekannt",
      servedBy: found?.servedBy ?? "",
    }
  })

  // If the round did not actually involve distinct models, say so rather than
  // presenting three names. The lesson of this station is that models differ;
  // inventing that difference would teach the opposite of checking.
  const distinct = distinctModelCount(revealed)
  const honest = distinct >= 2

  await fileEntry({
    kind: "ranking",
    voyageId: voyage.id,
    stationId: station.id,
    title: honest
      ? `Modelle sortiert: ${ranked.map((entry) => entry.name).join(" vor ")}`
      : "Modelle sortiert (Runde ohne echte Vielfalt)",
    ...(input.why ? { why: input.why } : {}),
    payload: { round: input.round ?? 0, ranked, distinct },
  })

  await markStation(voyage.id, station.id, { complete: true, score: ranked.length })

  return Response.json({ revealed: ranked, distinct, honest })
}
