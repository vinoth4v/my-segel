import { parseVoyage, type Station, type Voyage } from "@/segel/content-schema"
import voyage1 from "../../content/voyages/01-was-ist-das-ding.json" with { type: "json" }
import voyage2 from "../../content/voyages/02-die-jagd.json" with { type: "json" }
import voyage3 from "../../content/voyages/03-der-zoo.json" with { type: "json" }
import voyage4 from "../../content/voyages/04-das-prompt-labor.json" with { type: "json" }
import voyage5 from "../../content/voyages/05-die-werkstatt.json" with { type: "json" }
import voyage6 from "../../content/voyages/06-echt-oder-fake.json" with { type: "json" }
import voyage7 from "../../content/voyages/07-woher-kommt-das-alles.json" with { type: "json" }
import voyage8 from "../../content/voyages/08-wer-fehlt-darin.json" with { type: "json" }
import voyage9 from "../../content/voyages/09-wem-gehoert-das.json" with { type: "json" }
import voyage10 from "../../content/voyages/10-was-darf-es-selber-tun.json" with { type: "json" }
import voyage11 from "../../content/voyages/11-was-weiss-es-ueber-dich.json" with { type: "json" }

/**
 * The curriculum, loaded and validated.
 *
 * The six files are imported by name rather than read from the directory at
 * runtime. That is deliberate: a static import works identically in the dev
 * server, the production build and a unit test, needs no filesystem, and
 * makes a missing file a build error instead of an empty home page. Adding a
 * week means adding a line here, which is a small price for never wondering
 * whether the content shipped.
 *
 * Validation happens on first use, not at module scope — same rule as every
 * other lazy read in this app, so importing this cannot break `next build`.
 */

const RAW: { source: string; data: unknown }[] = [
  { source: "01-was-ist-das-ding.json", data: voyage1 },
  { source: "02-die-jagd.json", data: voyage2 },
  { source: "03-der-zoo.json", data: voyage3 },
  { source: "04-das-prompt-labor.json", data: voyage4 },
  { source: "05-die-werkstatt.json", data: voyage5 },
  { source: "06-echt-oder-fake.json", data: voyage6 },
  { source: "07-woher-kommt-das-alles.json", data: voyage7 },
  { source: "08-wer-fehlt-darin.json", data: voyage8 },
  { source: "09-wem-gehoert-das.json", data: voyage9 },
  { source: "10-was-darf-es-selber-tun.json", data: voyage10 },
  { source: "11-was-weiss-es-ueber-dich.json", data: voyage11 },
]

let cached: Voyage[] | undefined

export function voyages(): Voyage[] {
  if (cached) return cached

  const parsed = RAW.map(({ source, data }) => parseVoyage(data, source)).sort(
    (a, b) => a.number - b.number,
  )

  const ids = new Set<string>()
  for (const voyage of parsed) {
    if (ids.has(voyage.id)) throw new Error(`Two voyages share the id "${voyage.id}"`)
    ids.add(voyage.id)
  }

  cached = parsed
  return cached
}

export function voyageById(id: string): Voyage | undefined {
  return voyages().find((voyage) => voyage.id === id)
}

export function stationIn(voyage: Voyage, stationId: string): Station | undefined {
  return voyage.stations.find((station) => station.id === stationId)
}

/** Where a station sits overall, for "Station 2 von 3" and for the next link. */
export function stationPosition(voyage: Voyage, stationId: string) {
  const index = voyage.stations.findIndex((station) => station.id === stationId)
  return {
    index,
    total: voyage.stations.length,
    next: index >= 0 ? voyage.stations[index + 1] : undefined,
  }
}

/** Every station across every voyage — the denominator for progress. */
export function allStations(): { voyage: Voyage; station: Station }[] {
  return voyages().flatMap((voyage) => voyage.stations.map((station) => ({ voyage, station })))
}
