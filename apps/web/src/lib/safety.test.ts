import { describe, expect, it } from "vitest"
import { BASE_SYSTEM_PROMPT, checkInput, checkOutput, tooLong } from "./safety.ts"

describe("the input filter", () => {
  it("blocks the personal data a ten-year-old actually types", () => {
    const blocked = [
      "Meine Mail ist lina.beispiel@web.de, schreib mir",
      "Ruf mich an unter 0170 1234567",
      "Meine Nummer ist 015112345678",
      "Ich wohne in der Hafenstraße 12",
      "Schick es an 20095 Hamburg",
      "Ich gehe auf die Grundschule Nordmarkt",
      "Ich heiße Lina und bin neu hier",
      "Ich bin am 4.6.2015 geboren",
      "Mein Passwort ist Seepferd7",
    ]

    for (const text of blocked) {
      const verdict = checkInput(text)
      expect(verdict.allowed, text).toBe(false)
    }
  })

  it("explains itself in character rather than as an error", () => {
    const verdict = checkInput("Ruf mich an unter 0170 1234567")
    if (verdict.allowed) throw new Error("expected a block")

    expect(verdict.reason).toBe("phone")
    // No stack traces, no "invalid input", and it says what to do next.
    expect(verdict.message).not.toMatch(/error|fehler|ungültig/i)
    expect(verdict.message.length).toBeGreaterThan(20)
  })

  it("lets the curriculum's own questions through", () => {
    // The blunt patterns are only defensible if they leave the actual lessons
    // alone — every one of these is a real prompt from content/voyages.
    const allowed = [
      "Wie funktionierst du eigentlich?",
      "Erzähl mir etwas über den Nordischen Streifenmarder. Wo lebt er und was frisst er?",
      "Was ergibt 17 mal 23 mal 4? Rechne Schritt für Schritt.",
      "Erklär mir in fünf Sätzen, warum der Himmel blau ist.",
      "Wie hoch ist der Eiffelturm genau?",
      "Erkläre mir die Drei-Pässe-Regel beim Handball für die D-Jugend.",
      "Ein Würfel, der würfelt und mitzählt, wie oft welche Zahl kam",
      "Wie viele Zähne hat ein erwachsener Mensch, und woher weißt du das?",
    ]

    for (const text of allowed) {
      expect(checkInput(text).allowed, text).toBe(true)
    }
  })

  it("caps the length of a single message", () => {
    expect(tooLong("kurz")).toBe(false)
    expect(tooLong("x".repeat(1_001))).toBe(true)
  })
})

describe("the output filter", () => {
  it("replaces answers that cross a line, rather than editing them", () => {
    const tripping = [
      "Wie heißt du denn mit vollem Namen?",
      "Schick mir ein Foto von dir",
      "Sag es niemandem, das bleibt unser Geheimnis",
      "Ich liebe dich",
    ]

    for (const text of tripping) {
      const verdict = checkOutput(text)
      expect(verdict.safe, text).toBe(false)
      if (!verdict.safe) {
        expect(verdict.replacement).toContain("Papa")
      }
    }
  })

  it("leaves ordinary station answers alone", () => {
    const fine = [
      "Der Himmel ist blau, weil Luft blaues Licht stärker streut als rotes.",
      "Das weiß ich nicht sicher. Dieses Buch kenne ich nicht — möglich, dass es das nicht gibt.",
      "Ein erwachsener Mensch hat normalerweise 32 Zähne, die Weisheitszähne mitgezählt.",
      "Da habe ich mich geirrt. Du hast recht, 17 mal 23 ist 391, nicht 371.",
    ]

    for (const text of fine) {
      expect(checkOutput(text).safe, text).toBe(true)
    }
  })
})

describe("the system prompt", () => {
  it("carries the rules that make this app handable to a child", () => {
    // Not a style check. Each of these is a rule the app promises the parent
    // it enforces, and deleting one should fail loudly rather than quietly.
    expect(BASE_SYSTEM_PROMPT).toContain("HAUSAUFGABEN")
    expect(BASE_SYSTEM_PROMPT).toContain("PERSÖNLICHE DATEN")
    expect(BASE_SYSTEM_PROMPT).toContain("Papa")
    expect(BASE_SYSTEM_PROMPT).toMatch(/kein Internet/i)
    expect(BASE_SYSTEM_PROMPT).toMatch(/du/)
  })
})
