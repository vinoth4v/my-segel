import { auth } from "@/auth"
import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body } from "@/segel/guard"
import { checkInput } from "@/segel/safety"
import { fileEntry, markStation, progress } from "@/segel/store"

/**
 * Filing a catch — the button behind [Das stimmt nicht].
 *
 * This is the app's success metric being written down, so it is worth being
 * precise about what it stores: what the model said, and *her own words* for
 * why it was wrong. The second half is the pedagogy. A tally of catches with
 * no reasons would show a rising number and prove nothing.
 *
 * No model call, so no cap check — filing a catch must never be the thing
 * that hits the limit, or the app would punish her for the behaviour it
 * exists to encourage.
 */

type Body = {
  voyageId?: string
  stationId?: string
  kind?: "catch" | "note"
  title?: string
  detail?: string
  why?: string
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 })

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station) return badRequest("Diese Station gibt es nicht.")

  const why = (input.why ?? "").trim()
  if (!why) return badRequest("Schreib dazu, woran du es gemerkt hast.")

  const checked = checkInput(why)
  if (!checked.ok) return Response.json({ refused: checked.reason, message: checked.message })

  const kind = input.kind === "note" ? "note" : "catch"

  await fileEntry({
    kind,
    voyageId: voyage.id,
    stationId: station.id,
    title: (input.title ?? "Fehler gefangen").slice(0, 140),
    detail: (input.detail ?? "").slice(0, 4000),
    why: checked.text,
  })

  // The station's own tally, so the UI can show "2 von 3" without counting
  // rows in the browser.
  const rows = await progress()
  const existing = rows.find((row) => row.voyageId === voyage.id && row.stationId === station.id)
  const score = (existing?.score ?? 0) + 1
  const target = station.type === "jagd" ? station.targetCatches : 1

  await markStation(voyage.id, station.id, { score, complete: score >= target })

  return Response.json({ filed: true, score, target, complete: score >= target })
}
