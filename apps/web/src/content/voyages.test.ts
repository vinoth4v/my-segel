import { describe, expect, it } from "vitest"
import { nextStation, stationById, voyageBySlug, voyages } from "./voyages.ts"

/**
 * Phase 0's gate. The curriculum is the part of this app that decides whether
 * it is any good, and it is plain JSON with no compiler behind it — so this
 * test is the compiler.
 */
describe("the curriculum", () => {
  it("parses all six voyages against the schema", () => {
    // voyages() throws with the failing path when a file drifts from the
    // schema, so simply calling it is the assertion that matters.
    expect(voyages()).toHaveLength(6)
  })

  it("numbers the voyages 1..6 in order, with unique slugs", () => {
    const all = voyages()
    expect(all.map((voyage) => voyage.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(all.map((voyage) => voyage.slug)).size).toBe(6)
  })

  it("puts Die Jagd before the capability voyages", () => {
    // Not cosmetic ordering: scepticism is installed before she is shown what
    // the thing can do. Reordering these is a curriculum decision, so it has
    // to break a test rather than pass review as a tidy-up.
    const jagd = voyages().find((voyage) => voyage.slug === "die-jagd")
    const zoo = voyages().find((voyage) => voyage.slug === "der-zoo")
    const werkstatt = voyages().find((voyage) => voyage.slug === "die-werkstatt")

    expect(jagd?.id).toBeLessThan(zoo?.id ?? 0)
    expect(jagd?.id).toBeLessThan(werkstatt?.id ?? 0)
  })

  it("gives every station a unique id within its voyage", () => {
    for (const voyage of voyages()) {
      const ids = voyage.stations.map((station) => station.id)
      expect(new Set(ids).size, voyage.slug).toBe(ids.length)
    }
  })

  it("keeps every voyage inside the session cap it advertises", () => {
    // The anti-metric is time in app. A voyage whose stations add up to more
    // than its own estimate is a voyage that will overrun the 40-minute cap
    // and end mid-station, which reads to her as the app breaking.
    for (const voyage of voyages()) {
      const stationTotal = voyage.stations.reduce((sum, station) => sum + station.estMinutes, 0)
      expect(stationTotal, voyage.slug).toBeLessThanOrEqual(voyage.estMinutes)
      expect(voyage.estMinutes, voyage.slug).toBeLessThanOrEqual(40)
    }
  })

  it("marks the two voyages that need Papa in the seat", () => {
    const twoSeater = voyages()
      .filter((voyage) => voyage.twoSeater)
      .map((voyage) => voyage.slug)

    // The first conversation with a model and the media-literacy debrief are
    // both deliberately not solo.
    expect(twoSeater).toContain("was-ist-das-ding")
    expect(twoSeater).toContain("echt-oder-fake")
  })

  it("writes every parent note as guidance rather than a summary", () => {
    for (const voyage of voyages()) {
      expect(voyage.debrief.parentNote.length, voyage.slug).toBeGreaterThan(80)
      expect(voyage.debrief.questions.length, voyage.slug).toBeGreaterThan(0)
    }
  })

  it("gives the hunt enough bait, including one she writes herself", () => {
    const jagd = voyages()
      .flatMap((voyage) => voyage.stations)
      .find((station) => station.type === "jagd")

    expect(jagd).toBeDefined()
    if (jagd?.type !== "jagd") throw new Error("expected a jagd station")

    // Three catches in one session is the acceptance test for Phase 2, so
    // there has to be more bait than that — she will reject some.
    expect(jagd.targets.length).toBeGreaterThanOrEqual(5)
    expect(jagd.targets.some((target) => target.prompt === "")).toBe(true)
  })

  it("finds voyages and stations by their public identifiers", () => {
    const voyage = voyageBySlug("die-jagd")
    expect(voyage?.title).toBe("Die Jagd")
    expect(voyageBySlug("gibt-es-nicht")).toBeUndefined()

    if (!voyage) throw new Error("expected die-jagd")
    expect(stationById(voyage, "die-jagd")?.type).toBe("jagd")
    expect(stationById(voyage, "gibt-es-nicht")).toBeUndefined()
  })

  it("walks to the next unfinished station and stops at the end", () => {
    const voyage = voyageBySlug("was-ist-das-ding")
    if (!voyage) throw new Error("expected was-ist-das-ding")

    const first = voyage.stations[0]
    const second = voyage.stations[1]
    if (!first || !second) throw new Error("expected at least two stations")

    expect(nextStation(voyage, [])?.id).toBe(first.id)
    expect(nextStation(voyage, [first.id])?.id).toBe(second.id)
    expect(nextStation(voyage, voyage.stations.map((station) => station.id))).toBeUndefined()
  })
})
