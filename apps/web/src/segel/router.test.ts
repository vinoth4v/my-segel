import { describe, expect, it } from "vitest"
import { LANES } from "../kompass.ts"
import {
  describeModel,
  route,
  STATION_TYPES,
  WERKSTATT_LANES,
  ZOO_LANES,
  zooTrio,
} from "./router.ts"

describe("station routing", () => {
  it("routes every station type to a lane the gateway actually knows", () => {
    // The bug this replaces: the router asked for model names like
    // "kompass:google/gemini-3.6-flash". The gateway answers 200 to those and
    // silently serves its default lane, so nothing failed and nothing noticed.
    // Only the six lane aliases are real.
    for (const station of STATION_TYPES) {
      const resolved = route(station)
      expect(LANES, station).toContain(resolved.lane)
      expect(resolved.maxTokens, station).toBeGreaterThan(0)
    }
  })

  it("puts Die Jagd on the weakest lane, because being wrong is the lesson", () => {
    // If this silently becomes a strong lane, week two stops working and
    // nothing else in the app would notice.
    expect(route("jagd").lane).toBe("kompass-simple")
  })

  it("gives Gespräch the instruction-following lane", () => {
    expect(route("talk").lane).toBe("kompass-agentic")
  })

  it("gives the Werkstatt more room than a chat reply", () => {
    expect(route("werkstatt").maxTokens).toBeGreaterThan(route("talk").maxTokens)
  })

  it("escalates the Werkstatt through real lanes, weakest first", () => {
    expect(WERKSTATT_LANES.length).toBeGreaterThan(1)
    for (const lane of WERKSTATT_LANES) expect(LANES).toContain(lane)
    expect(new Set(WERKSTATT_LANES).size).toBe(WERKSTATT_LANES.length)
  })
})

describe("the zoo roster", () => {
  it("contains only lanes, and only real ones", () => {
    for (const lane of ZOO_LANES) expect(LANES).toContain(lane)
  })

  it("never lists two lanes that resolve to the same model", () => {
    // kompass-fast and kompass-simple are both served by gpt-oss-120b today.
    // Drawing both would put one model on the table twice under two letters —
    // a quieter version of the bug this station was fixed for.
    const roster: readonly string[] = ZOO_LANES
    expect(roster).toContain("kompass-fast")
    expect(roster).not.toContain("kompass-simple")
  })

  it("picks three distinct lanes", () => {
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
})

describe("naming what answered", () => {
  it("names the models this gateway actually reports", () => {
    // Every string here was observed in a real x-kompass-served-by header.
    expect(describeModel("groq/openai/gpt-oss-120b").name).toBe("GPT-OSS 120B")
    expect(describeModel("nvidia/minimaxai/minimax-m3").name).toBe("MiniMax")
    expect(describeModel("google/gemini-3.5-flash-lite").name).toBe("Gemini")
    expect(describeModel("mistral/mistral-small-latest").name).toBe("Mistral SMALL")
  })

  it("keeps the size variant, so two models in a family stay two models", () => {
    // A lane serves a chain, not a fixed model: one sampling run returned
    // laguna-xs and laguna-s from the same roster. Collapsing both to
    // "Laguna" would put two Zoo cards under one name.
    const xs = describeModel("openrouter/poolside/laguna-xs-2.1:free")
    const s = describeModel("openrouter/poolside/laguna-s-2.1:free")
    expect(xs.name).toBe("Laguna XS")
    expect(s.name).toBe("Laguna S")
    expect(xs.name).not.toBe(s.name)

    expect(describeModel("groq/openai/gpt-oss-20b").name).not.toBe(
      describeModel("groq/openai/gpt-oss-120b").name,
    )
  })

  it("gives an origin she can learn something from", () => {
    expect(describeModel("groq/openai/gpt-oss-120b").origin).toContain("USA")
    expect(describeModel("nvidia/minimaxai/minimax-m3").origin).toContain("China")
  })

  it("never invents a name for a model it does not recognise", () => {
    // The one thing this station must not do is tell her a model was
    // something it was not. An unknown model is named from its own string.
    const unknown = describeModel("someprovider/brand-new-model:free")
    expect(unknown.name).toBe("brand-new-model")
    expect(unknown.origin).toBe("unbekannt")
  })

  it("survives an empty header without crashing the reveal", () => {
    expect(describeModel("").name).toBe("unbekannt")
  })
})
