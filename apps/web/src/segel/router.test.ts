import { describe, expect, it } from "vitest"
import { PINS, route, STATION_TYPES, ZOO_PROFILES, zooTrio } from "./router.ts"

describe("station routing", () => {
  it("routes every station type", () => {
    for (const station of STATION_TYPES) {
      const resolved = route(station)
      expect(resolved.lane, station).toBeTruthy()
      expect(resolved.maxTokens, station).toBeGreaterThan(0)
    }
  })

  it("pins Die Jagd to a weak model, because being wrong is the lesson", () => {
    // If this ever silently becomes a strong model, week two stops working
    // and nothing else in the app would notice.
    expect(route("jagd").model).toBe(PINS.jagd)
  })

  it("pins the Prompt-Labor, so the comparison measures her prompt", () => {
    // The station's validity depends on both halves running on one model.
    // An unpinned labor route would make the comparison meaningless while
    // still looking like it worked.
    expect(route("labor").model).toBe(PINS.labor)
  })

  it("leaves Gespräch on a lane, so the gateway always has a fallback", () => {
    // The one child-facing open conversation: a dead pin here would be a
    // broken station rather than a slightly different answer.
    expect(route("talk").model).toBeUndefined()
  })

  it("gives the Werkstatt more room than a chat reply", () => {
    expect(route("werkstatt").maxTokens).toBeGreaterThan(route("talk").maxTokens)
  })
})

describe("the zoo trio", () => {
  it("picks three distinct models", () => {
    for (let round = 0; round < 12; round += 1) {
      const trio = zooTrio(round)
      expect(trio, `round ${round}`).toHaveLength(3)
      expect(new Set(trio).size, `round ${round}`).toBe(3)
    }
  })

  it("is stable for a round, so a reload cannot reshuffle a blind ranking", () => {
    expect(zooTrio(3)).toEqual(zooTrio(3))
  })

  it("varies between rounds, so a second round is actually different", () => {
    const rounds = new Set([0, 1, 2, 3].map((round) => zooTrio(round).join()))
    expect(rounds.size).toBeGreaterThan(1)
  })

  it("can name every model it might draw", () => {
    // The reveal is the payoff of the station; a model with no profile would
    // show her a raw gateway string instead of a name and an origin.
    for (const model of PINS.zoo) {
      expect(ZOO_PROFILES[model], model).toBeDefined()
    }
  })
})
