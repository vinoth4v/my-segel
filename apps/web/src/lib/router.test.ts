import { afterEach, describe, expect, it } from "vitest"
import { fallbackFor, laborRoute, route, zooRoutes } from "./router.ts"

const PINS = ["SEGEL_PIN_TALK", "SEGEL_PIN_JAGD", "SEGEL_PIN_LABOR", "SEGEL_PIN_ZOO"]

afterEach(() => {
  for (const key of PINS) delete process.env[key]
})

describe("station routing", () => {
  it("sends the hunt to the weakest lane, on purpose", () => {
    // The single most important assertion in this file. Routing `jagd` to a
    // strong model silently deletes the core week of the curriculum, and it
    // is exactly the kind of change that looks like an improvement in review.
    expect(route("jagd").model).toBe("kompass-simple")
  })

  it("never rescues the hunt with a stronger model", () => {
    expect(fallbackFor("jagd", 0)).toBeUndefined()
    expect(fallbackFor("jagd", 1)).toBeUndefined()
  })

  it("escalates everything else once, then to the paid lane, then stops", () => {
    expect(fallbackFor("werkstatt", 0)?.model).toBe("kompass-fast")
    expect(fallbackFor("werkstatt", 1)?.model).toBe("kompass-hard")
    expect(fallbackFor("werkstatt", 2)).toBeUndefined()
  })

  it("gives the child-facing conversation a lane built for care, not for cost", () => {
    expect(route("talk").model).toBe("kompass-fast")
  })

  it("reads a pin from the environment when one is set", () => {
    process.env.SEGEL_PIN_JAGD = "kompass:openai/gpt-oss-120b"
    expect(route("jagd").model).toBe("kompass:openai/gpt-oss-120b")
  })

  it("ignores a blank pin rather than sending an empty model", () => {
    process.env.SEGEL_PIN_TALK = "   "
    expect(route("talk").model).toBe("kompass-fast")
  })
})

describe("the zoo", () => {
  it("asks three genuinely different models", () => {
    const models = zooRoutes().map((column) => column.model)
    expect(new Set(models).size).toBe(3)
  })

  it("labels the columns A, B, C so the reveal can come last", () => {
    expect(zooRoutes().map((column) => column.label)).toEqual(["A", "B", "C"])
  })

  it("gives each column a deadline short enough that one slow model is not fatal", () => {
    // The acceptance test is three columns inside eight seconds, with a
    // timeout on one not blocking the other two.
    for (const column of zooRoutes()) {
      expect(column.timeoutMs).toBeLessThanOrEqual(8_000)
    }
  })

  it("takes a pinned line-up when one is configured", () => {
    process.env.SEGEL_PIN_ZOO = "kompass:a/one, kompass:b/two ,kompass:c/three"
    expect(zooRoutes().map((column) => column.model)).toEqual([
      "kompass:a/one",
      "kompass:b/two",
      "kompass:c/three",
    ])
  })

  it("falls back to lanes for columns a short pin list does not cover", () => {
    process.env.SEGEL_PIN_ZOO = "kompass:a/one"
    const models = zooRoutes().map((column) => column.model)
    expect(models[0]).toBe("kompass:a/one")
    expect(models[1]).toBe("kompass-simple")
    expect(models[2]).toBe("kompass-agentic")
  })
})

describe("the prompt lab", () => {
  it("uses one model for both sides", () => {
    // If the two halves ran on different models the comparison would measure
    // the models, and she would draw the wrong conclusion from a real result.
    process.env.SEGEL_PIN_LABOR = "kompass:x/mid"
    const left = laborRoute()
    const right = laborRoute()
    expect(left.model).toBe(right.model)
    expect(left.model).toBe("kompass:x/mid")
  })
})
