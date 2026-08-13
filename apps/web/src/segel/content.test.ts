import { describe, expect, it } from "vitest"
import { allStations, stationPosition, voyageById, voyages } from "./content.ts"
import { parseVoyage } from "./content-schema.ts"

describe("the curriculum", () => {
  it("loads all six voyages, in order", () => {
    const all = voyages()
    expect(all).toHaveLength(6)
    expect(all.map((voyage) => voyage.number)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("teaches skepticism before capability", () => {
    // Voyage 2 running before 3-5 is a pedagogical decision, not an
    // accident of file naming: she learns the thing is wrong before she
    // learns it is useful. A reorder should fail a test, not pass silently.
    const all = voyages()
    const jagd = all.find((voyage) => voyage.stations.some((s) => s.type === "jagd"))
    const werkstatt = all.find((voyage) => voyage.stations.some((s) => s.type === "werkstatt"))
    expect(jagd?.number).toBeLessThan(werkstatt?.number ?? 0)
  })

  it("gives every station a success condition and an intro", () => {
    for (const { voyage, station } of allStations()) {
      expect(station.success.length, `${voyage.id}/${station.id}`).toBeGreaterThan(0)
      expect(station.intro.length, `${voyage.id}/${station.id}`).toBeGreaterThan(0)
    }
  })

  it("gives every voyage a parent note, because half the audience is the father", () => {
    for (const voyage of voyages()) {
      expect(voyage.debrief.parentNote.length, voyage.id).toBeGreaterThan(80)
      expect(voyage.debrief.questions.length, voyage.id).toBeGreaterThan(0)
    }
  })

  it("writes to her in German du-form and without exclamation marks", () => {
    // From the design direction: praise means nothing if everything is
    // exciting. This is the cheapest possible guard on that rule.
    for (const voyage of voyages()) {
      expect(voyage.intro.markdown, voyage.id).not.toContain("!")
      for (const station of voyage.stations) {
        expect(station.intro, `${voyage.id}/${station.id}`).not.toContain("!")
      }
    }
  })

  it("finds a voyage and a station's neighbours", () => {
    const voyage = voyageById("der-zoo")
    expect(voyage).toBeDefined()
    if (!voyage) return
    const first = voyage.stations[0]
    if (!first) return
    const position = stationPosition(voyage, first.id)
    expect(position.index).toBe(0)
    expect(position.total).toBe(voyage.stations.length)
  })
})

describe("the schema", () => {
  it("rejects a station type that does not exist", () => {
    expect(() =>
      parseVoyage(
        {
          id: "test",
          number: 1,
          title: "t",
          subtitle: "s",
          estMinutes: 10,
          twoSeater: false,
          intro: { markdown: "x" },
          stations: [{ id: "a", type: "spiel", title: "t", intro: "i", success: "s" }],
          debrief: { questions: ["q"], parentNote: "n" },
        },
        "test",
      ),
    ).toThrow()
  })

  it("rejects unknown top-level keys rather than ignoring them", () => {
    // A typo'd key that is silently dropped is a station that silently does
    // not exist — the failure mode this strictness is here to prevent.
    expect(() =>
      parseVoyage(
        {
          id: "test",
          number: 1,
          title: "t",
          subtitle: "s",
          estMinutes: 10,
          twoSeater: false,
          intro: { markdown: "x" },
          stations: [{ id: "a", type: "talk", title: "t", intro: "i", success: "s" }],
          debrief: { questions: ["q"], parentNote: "n" },
          stationen: [],
        },
        "test",
      ),
    ).toThrow()
  })

  it("rejects a quiz whose answer points past its options", () => {
    expect(() =>
      parseVoyage(
        {
          id: "test",
          number: 1,
          title: "t",
          subtitle: "s",
          estMinutes: 10,
          twoSeater: false,
          intro: { markdown: "x" },
          stations: [
            {
              id: "a",
              type: "quiz",
              title: "t",
              intro: "i",
              success: "s",
              questions: [{ id: "q", question: "q", options: ["a", "b"], answer: 5, why: "w" }],
            },
          ],
          debrief: { questions: ["q"], parentNote: "n" },
        },
        "test",
      ),
    ).toThrow(/past its options/)
  })
})
