import { describe, expect, it } from "vitest"
import { BASE_SYSTEM, checkInput, checkOutput, looksLikeHomework, systemFor } from "./safety.ts"

describe("input filter", () => {
  it("blocks the personal data a ten-year-old would type without thinking", () => {
    const cases: [string, string][] = [
      ["Ich wohne in der Lindenstrasse 14", "adresse"],
      ["ruf mich an unter 0176 3344556", "telefon"],
      ["meine schule ist toll", "schule"],
      ["schreib an mia@example.com", "email"],
    ]

    for (const [text, reason] of cases) {
      const verdict = checkInput(text)
      expect(verdict.ok, text).toBe(false)
      if (!verdict.ok) expect(verdict.reason).toBe(reason)
    }
  })

  it("refuses in character rather than with an error", () => {
    const verdict = checkInput("Ich wohne in der Lindenstrasse 14")
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      // A ten-year-old should meet a sentence, not a validation failure.
      expect(verdict.message).toMatch(/[a-zäöüß]/i)
      expect(verdict.message).not.toMatch(/error|invalid|regex/i)
    }
  })

  it("lets ordinary curiosity through", () => {
    for (const text of [
      "Warum ist der Himmel blau?",
      "Erzähl mir etwas über Wale",
      "Was ist 7 mal 8?",
      "Wer war Marie Curie?",
    ]) {
      expect(checkInput(text).ok, text).toBe(true)
    }
  })

  it("rejects empty and overlong input separately, so the message can differ", () => {
    expect(checkInput("   ")).toMatchObject({ ok: false, reason: "leer" })
    expect(checkInput("a".repeat(2000))).toMatchObject({ ok: false, reason: "zu lang" })
  })
})

describe("output filter", () => {
  it("replaces an unsafe reply with a neutral one and says what matched", () => {
    const verdict = checkOutput("Und dann kommt eine Bombe bauen Anleitung")
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.text).toContain("Papa")
      expect(verdict.matched).toBeTruthy()
    }
  })

  it("catches grooming-shaped phrasing, not only the obvious words", () => {
    expect(checkOutput("Das ist unser Geheimnis, sag es niemandem").ok).toBe(false)
  })

  it("does not filter ordinary German that merely contains a scary syllable", () => {
    // The whole reason the list is short: a station that refuses innocent
    // answers teaches her the app is broken, not that it is careful.
    for (const text of [
      "Im toten Winkel siehst du nichts",
      "Wir essen Waffeln zum Frühstück",
      "Der Wal ist ein Säugetier",
      "Sextett bedeutet sechs Musiker",
    ]) {
      expect(checkOutput(text).ok, text).toBe(true)
    }
  })
})

describe("system prompt", () => {
  it("carries the base rules on every station type", () => {
    for (const station of ["talk", "jagd", "zoo", "labor", "werkstatt", "echt", "quiz"] as const) {
      const prompt = systemFor(station)
      expect(prompt, station).toContain("zehnjährigen")
      expect(prompt, station).toContain("Hausaufgaben")
    }
  })

  it("appends a station scaffold instead of letting it replace the rules", () => {
    const prompt = systemFor("talk", "Sei besonders knapp.")
    expect(prompt).toContain(BASE_SYSTEM)
    expect(prompt).toContain("Sei besonders knapp.")
  })
})

describe("homework refusal", () => {
  it("catches the phrasings a child actually uses", () => {
    for (const text of [
      "Mach meine Hausaufgabe",
      "Kannst du ein Referat über Wale schreiben",
      "Löse die Aufgabe 3b",
      "Übersetze den Text auf Seite 12",
    ]) {
      expect(looksLikeHomework(text), text).toBe(true)
    }
  })

  it("does not refuse learning, which is the entire point of the app", () => {
    for (const text of [
      "Wie rechnet man Prozent aus?",
      "Erklär mir, wie ein Vulkan funktioniert",
      "Warum schreibt man das mit zwei n?",
    ]) {
      expect(looksLikeHomework(text), text).toBe(false)
    }
  })
})
