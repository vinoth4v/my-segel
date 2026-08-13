/**
 * Scores a draft prompt before it runs.
 *
 * Not a grade. The meter exists so she can see *what is missing* while she is
 * still writing — the same four levers the Labor station offers, checked
 * against her own draft. A number with no named gap would be a judgement; the
 * gaps are the useful part, and the score is only there to make the gaps feel
 * worth closing.
 *
 * Deliberately a plain function with no model behind it: it has to respond as
 * she types, and a round trip per keystroke would be both slow and absurd.
 */

export type Lever = "rolle" | "genau" | "nicht" | "laenge"

export type PromptScore = {
  /** 0–4, one point per lever that is actually present. */
  score: number
  /** Which levers she has already pulled. */
  present: Lever[]
  /** What to try next — at most one, so it reads as a nudge and not a report card. */
  suggestion: string | null
  /** Shown next to the meter. Short, du-form, no praise inflation. */
  label: string
}

const ROLE = /\b(als|wie ein|wie eine|du bist|stell dir vor,? du)\b/i
const NEGATIVE = /\b(nicht|ohne|keine?n?|vermeide|lass weg|verzichte)\b/i
const LENGTH = /\b(s(ä|ae)tzen?|w(ö|oe)rter|absatz|punkten|kurz|knapp|stichpunkte|zeilen)\b/i
const SPECIFIC = /\b(zum beispiel|beispiel|genau|konkret|schritt f(ü|ue)r schritt|bezogen auf)\b/i

const SUGGESTIONS: Record<Lever, string> = {
  genau: "Sag genauer, was du wissen willst. Ein Beispiel oder ein Detail hilft am meisten.",
  laenge: "Sag, wie lang die Antwort sein soll. Sonst wird sie lang.",
  nicht: "Sag auch, was du nicht willst. Keine Fachwörter, keine Liste.",
  rolle: "Sag, wer antworten soll. Eine Tierärztin erklärt anders als ein Comedian.",
}

/** Order matters: the first missing lever is the one suggested, strongest first. */
const LEVER_ORDER: Lever[] = ["genau", "laenge", "nicht", "rolle"]

/**
 * No exclamation marks and no escalation — "stark" is the top and it is stated
 * flatly. Praise that gets louder as the number rises is how a meter stops
 * meaning anything.
 */
const LABELS: Record<number, string> = {
  0: "Sehr offen. Das Modell muss raten, was du meinst.",
  1: "Ein Anfang.",
  2: "Schon brauchbar.",
  3: "Gut gezielt.",
  4: "Stark. Alle vier Hebel gezogen.",
}

export function scorePrompt(draft: string): PromptScore {
  const text = draft.trim()

  if (!text) {
    return { score: 0, present: [], suggestion: null, label: "Noch nichts geschrieben" }
  }

  const present: Lever[] = []

  // "Genau" is the only lever that is partly about effort rather than
  // vocabulary — a one-word question is vague whatever words it uses, so
  // length counts towards it alongside the specificity markers.
  const words = text.split(/\s+/).filter(Boolean).length
  if (SPECIFIC.test(text) || words >= 12) present.push("genau")
  if (LENGTH.test(text)) present.push("laenge")
  if (NEGATIVE.test(text)) present.push("nicht")
  if (ROLE.test(text)) present.push("rolle")

  const missing = LEVER_ORDER.filter((lever) => !present.includes(lever))
  const first = missing[0]
  const score = present.length

  return {
    score,
    present,
    suggestion: first ? SUGGESTIONS[first] : null,
    label: LABELS[score] ?? LABELS[0] ?? "",
  }
}

/**
 * Builds the right-hand prompt from her draft and the levers she picked.
 *
 * The assembled version keeps her own question as its first line, on purpose:
 * the comparison is meant to show what the additions did, and rewriting her
 * words would make it show something else.
 */
export function assemblePrompt(draft: string, chosen: Partial<Record<Lever, string>>): string {
  const parts = [draft.trim()]

  if (chosen.rolle) parts.push(`Antworte ${chosen.rolle}.`)
  if (chosen.genau) parts.push(`Und zwar: ${chosen.genau}.`)
  if (chosen.nicht) parts.push(`Bitte ${chosen.nicht}.`)
  if (chosen.laenge) parts.push(`Antworte ${chosen.laenge}.`)

  return parts.filter(Boolean).join(" ")
}
