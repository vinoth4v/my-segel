import { describe, expect, it } from "vitest"
import { distinctModelCount, LETTER_TAG, pairLettersToModels } from "./zoo.ts"

const at = (minutes: number) => new Date(2026, 0, 1, 12, minutes)

function row(letter: string, servedBy: string | null, minutes: number, text = "eine Antwort") {
  return { content: `${LETTER_TAG}${letter} ${text}`, servedBy, at: at(minutes) }
}

describe("pairing letters to the models that answered", () => {
  it("pairs each letter with its own served-by", () => {
    const paired = pairLettersToModels([
      row("C", "nvidia/minimaxai/minimax-m3", 3),
      row("B", "openrouter/nvidia/nemotron-3-super-120b-a12b:free", 2),
      row("A", "groq/openai/gpt-oss-120b", 1),
    ])

    expect(paired.get("A")?.name).toBe("GPT-OSS")
    expect(paired.get("B")?.name).toBe("Nemotron")
    expect(paired.get("C")?.name).toBe("MiniMax")
  })

  it("takes the newest round when a station has been played twice", () => {
    // Rows arrive newest first. An older round's rows must not leak into a
    // later reveal, or she is told the wrong model said the thing she read.
    const paired = pairLettersToModels([
      row("A", "nvidia/minimaxai/minimax-m3", 9),
      row("A", "groq/openai/gpt-oss-120b", 1),
    ])

    expect(paired.get("A")?.name).toBe("MiniMax")
  })

  it("ignores rows that are not tagged, including a model quoting brackets", () => {
    const paired = pairLettersToModels([
      { content: "[A] das habe ich selbst geschrieben", servedBy: "x/y", at: at(5) },
      row("A", "groq/openai/gpt-oss-120b", 4),
    ])

    expect(paired.size).toBe(1)
    expect(paired.get("A")?.name).toBe("GPT-OSS")
  })

  it("still pairs a letter whose model failed, so the letters stay aligned", () => {
    const paired = pairLettersToModels([
      row("B", null, 2, "keine Antwort: timeout"),
      row("A", "groq/openai/gpt-oss-120b", 1),
    ])

    expect(paired.get("B")?.name).toBe("unbekannt")
    expect(paired.get("A")?.name).toBe("GPT-OSS")
  })
})

describe("guarding the reveal's honesty", () => {
  it("counts three genuinely different models as three", () => {
    const paired = pairLettersToModels([
      row("A", "groq/openai/gpt-oss-120b", 1),
      row("B", "openrouter/nvidia/nemotron-3-super-120b-a12b:free", 2),
      row("C", "nvidia/minimaxai/minimax-m3", 3),
    ])
    expect(distinctModelCount([...paired.values()])).toBe(3)
  })

  it("notices when the gateway served one model under three letters", () => {
    // This is precisely the shipped bug: three lanes, one model, and a reveal
    // that cheerfully named three. The count is what lets the route refuse to
    // claim variety that did not happen.
    const paired = pairLettersToModels([
      row("A", "groq/openai/gpt-oss-120b", 1),
      row("B", "groq/openai/gpt-oss-120b", 2),
      row("C", "groq/openai/gpt-oss-120b", 3),
    ])
    expect(distinctModelCount([...paired.values()])).toBe(1)
  })
})
