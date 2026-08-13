import { describe, expect, it } from "vitest"
import { promptStrength } from "./strength.ts"

describe("the prompt strength meter", () => {
  it("scores an empty prompt at zero and names all four missing levers", () => {
    const score = promptStrength("")
    expect(score.value).toBe(0)
    expect(score.missing).toHaveLength(4)
  })

  it("scores the weak version below the strong one", () => {
    const weak = promptStrength("Erzähl was über Schiffe")
    const strong = promptStrength(
      "Antworte als eine Schiffsbauerin. Erklär mir, warum Stahl schwimmt. Verwende keine Fachwörter. Schreib vier Sätze.",
    )
    expect(strong.value).toBeGreaterThan(weak.value)
    expect(strong.missing).toHaveLength(0)
  })

  it("does not reward length on its own", () => {
    // A rambling prompt with no levers must not creep up the bar, or the
    // meter would teach her that more words is better.
    const rambling = promptStrength(
      "also ich wollte fragen und zwar geht es um schiffe und da ist so eine sache die ich schon lange wissen wollte und zwar",
    )
    expect(rambling.value).toBeLessThan(0.3)
  })

  it("credits each lever independently", () => {
    expect(promptStrength("Antworte als Kapitänin.").missing).not.toContain("wer")
    expect(promptStrength("Schreib höchstens vier Sätze.").missing).not.toContain("wie lang")
    expect(promptStrength("Erklär es ohne Fachwörter.").missing).not.toContain("was nicht")
    expect(promptStrength("Warum schwimmt Stahl?").missing).not.toContain("was genau")
  })
})
