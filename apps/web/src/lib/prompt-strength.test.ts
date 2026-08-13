import { describe, expect, it } from "vitest"
import { assemblePrompt, scorePrompt } from "./prompt-strength.ts"

describe("the prompt meter", () => {
  it("says nothing about an empty box", () => {
    const result = scorePrompt("   ")
    expect(result.score).toBe(0)
    expect(result.suggestion).toBeNull()
  })

  it("rates a bare question low and names the most useful missing lever", () => {
    const result = scorePrompt("Erzähl mir was über Hunde")
    expect(result.score).toBeLessThanOrEqual(1)
    expect(result.suggestion).toMatch(/genauer|lang/i)
  })

  it("gives full marks only when all four levers are pulled", () => {
    const result = scorePrompt(
      "Erklär mir als Tierärztin in drei Sätzen genau, warum mein Hund nachts bellt, ohne Fachwörter",
    )
    expect(result.score).toBe(4)
    expect(result.present).toEqual(
      expect.arrayContaining(["rolle", "genau", "nicht", "laenge"]),
    )
    expect(result.suggestion).toBeNull()
  })

  it("counts a long, detailed question as specific even without a keyword", () => {
    // Specificity is partly effort, not vocabulary — a careful long question
    // should not score zero because it happens to avoid the word "genau".
    const result = scorePrompt(
      "Warum bellt mein Hund immer nachts um drei, wenn draußen ein Auto vorbeifährt",
    )
    expect(result.present).toContain("genau")
  })

  it("never praises with an exclamation mark", () => {
    // House style, and it matters: praise that shouts at every level stops
    // carrying information.
    for (const draft of ["Hi", "Erklär mir als Lehrer in zwei Sätzen ohne Fachwörter genau X"]) {
      expect(scorePrompt(draft).label).not.toContain("!")
    }
  })
})

describe("assembling the stronger prompt", () => {
  it("keeps her own words first and adds the levers after", () => {
    const assembled = assemblePrompt("Warum ist der Himmel blau", {
      rolle: "wie eine Wissenschaftlerin",
      laenge: "in drei Sätzen",
    })

    expect(assembled.startsWith("Warum ist der Himmel blau")).toBe(true)
    expect(assembled).toContain("wie eine Wissenschaftlerin")
    expect(assembled).toContain("in drei Sätzen")
  })

  it("adds nothing when she picked no levers", () => {
    expect(assemblePrompt("Warum ist der Himmel blau", {})).toBe("Warum ist der Himmel blau")
  })

  it("scores higher after assembly than before — the point of the station", () => {
    const draft = "Erzähl mir was über Hunde"
    const assembled = assemblePrompt(draft, {
      rolle: "wie eine Tierärztin",
      genau: "warum er nachts bellt",
      nicht: "keine Fachwörter benutzen",
      laenge: "in drei Sätzen",
    })

    expect(scorePrompt(assembled).score).toBeGreaterThan(scorePrompt(draft).score)
  })
})
