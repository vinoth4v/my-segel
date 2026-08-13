import voyage1 from "../../content/voyages/01-was-ist-das-ding.json"
import voyage2 from "../../content/voyages/02-die-jagd.json"
import voyage3 from "../../content/voyages/03-der-zoo.json"
import voyage4 from "../../content/voyages/04-das-prompt-labor.json"
import voyage5 from "../../content/voyages/05-die-werkstatt.json"
import voyage6 from "../../content/voyages/06-echt-oder-fake.json"
import { type Station, type Voyage, voyageSchema } from "./schema.ts"

/**
 * The curriculum, loaded and validated.
 *
 * Imported statically rather than read from disk at runtime: the files ship
 * with the deployment, the bundler can see them, and there is no filesystem on
 * the serverless runtime to read from anyway. Adding a voyage means adding an
 * import here — one line, and deliberately not a glob, so an unfinished draft
 * sitting in the folder cannot reach her by merely existing.
 *
 * Relative imports rather than the `@/` alias throughout this file and `lib/`,
 * because Vitest resolves tsconfig paths only with an extra plugin and the
 * unit tests are what keep this content honest.
 */
const raw = [voyage1, voyage2, voyage3, voyage4, voyage5, voyage6]

let cached: Voyage[] | undefined

/**
 * Parsed on first use, then held. A failure here is a content bug and throws
 * loudly — `voyages.test.ts` runs this, so a bad voyage fails in CI rather
 * than rendering an empty page in front of the one person this app is for.
 */
export function voyages(): Voyage[] {
  if (cached) return cached

  cached = raw.map((entry, index) => {
    const parsed = voyageSchema.safeParse(entry)
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
      throw new Error(`Voyage ${index + 1} is not valid content: ${problems}`)
    }
    return parsed.data
  })

  return cached
}

export function voyageBySlug(slug: string): Voyage | undefined {
  return voyages().find((voyage) => voyage.slug === slug)
}

export function stationById(voyage: Voyage, stationId: string): Station | undefined {
  return voyage.stations.find((station) => station.id === stationId)
}

/** The first station she has not finished yet, or undefined when the voyage is done. */
export function nextStation(
  voyage: Voyage,
  completedStationIds: readonly string[],
): Station | undefined {
  return voyage.stations.find((station) => !completedStationIds.includes(station.id))
}
