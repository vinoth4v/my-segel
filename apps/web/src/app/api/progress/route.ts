import { auth } from "@/auth"
import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body } from "@/segel/guard"
import { markStation, startStation } from "@/segel/store"

/**
 * Marking a station opened or finished.
 *
 * Stations that need no model — the quiz, the six pictures, reading the
 * intro — report their own completion here, so progress has one shape
 * regardless of whether a station happened to call a model.
 */

type Body = {
  voyageId?: string
  stationId?: string
  action?: "start" | "complete"
  score?: number
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 })

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station) return badRequest("Diese Station gibt es nicht.")

  if (input.action === "complete") {
    await markStation(voyage.id, station.id, {
      complete: true,
      ...(typeof input.score === "number" ? { score: Math.max(0, Math.round(input.score)) } : {}),
    })
  } else {
    await startStation(voyage.id, station.id)
  }

  return Response.json({ ok: true })
}
