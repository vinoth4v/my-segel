import type { StationType } from "@/segel/router"

/**
 * What may be sent to a model, and what may be shown to a ten-year-old.
 *
 * Built in rather than retrofitted, because a filter added later only covers
 * the calls somebody remembered to route through it. Everything here is
 * pure — no database, no model — so a route handler can apply it before it
 * does anything expensive, and so it can be tested exhaustively.
 */

export type Verdict =
  | { ok: true; text: string }
  | { ok: false; reason: PersonalDataKind | "leer" | "zu lang"; message: string }

export type PersonalDataKind = "adresse" | "telefon" | "schule" | "email" | "voller-name"

/**
 * Patterns for the things she must not type into a model.
 *
 * Regex is a blunt instrument and misses plenty; it is here because it is
 * instant, free and catches the obvious cases before the text ever leaves the
 * server. It is a floor, not the whole story — the system prompt refuses to
 * *collect* personal data, and the parent can read every transcript.
 */
const PERSONAL: { kind: PersonalDataKind; pattern: RegExp }[] = [
  { kind: "email", pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  // German landline/mobile shapes, and anything long enough to be a number.
  { kind: "telefon", pattern: /(\+\d{1,3}[\s/-]?)?(\(?\d{3,5}\)?[\s/-]?)\d{3,}[\s-]?\d{2,}/ },
  {
    kind: "adresse",
    pattern:
      /\b(\w+(stra(ss|ß)e|str\.|weg|gasse|allee|platz)\s*\d+|ich wohne in|meine adresse|postleitzahl|\bplz\b)/i,
  },
  {
    kind: "schule",
    pattern:
      /\b(meine schule|ich gehe (in|auf) die|grundschule|gymnasium|realschule|klassenlehrer)/i,
  },
]

const FRIENDLY: Record<PersonalDataKind, string> = {
  adresse: "Wo du wohnst, bleibt bei dir. Frag das Modell lieber etwas über die Welt.",
  telefon: "Telefonnummern gehören nicht ins Netz. Nimm sie raus, dann segeln wir weiter.",
  schule: "Deine Schule ist deine Sache. Das Modell braucht sie nicht zu wissen.",
  email: "E-Mail-Adressen behalten wir für uns. Schreib die Frage ohne sie noch mal.",
  "voller-name": "Vornamen reichen hier. Ganze Namen bleiben an Bord.",
}

const MAX_INPUT = 1200

/** Checks what she typed, before it costs anything. */
export function checkInput(raw: string): Verdict {
  const text = raw.trim()

  if (!text) {
    return { ok: false, reason: "leer", message: "Da steht noch nichts. Schreib deine Frage auf." }
  }
  if (text.length > MAX_INPUT) {
    return {
      ok: false,
      reason: "zu lang",
      message: "Das ist sehr lang. Kürze es auf das, was du wirklich wissen willst.",
    }
  }

  for (const { kind, pattern } of PERSONAL) {
    if (pattern.test(text)) {
      return { ok: false, reason: kind, message: FRIENDLY[kind] }
    }
  }

  return { ok: true, text }
}

/**
 * Words that mean a reply is not for her, whatever else it says.
 *
 * Kept short and specific. A long list of banned words filters ordinary
 * German — "toten Winkel", "Waffeln" — and a station that refuses innocent
 * answers teaches her the app is broken rather than that it is careful.
 */
const UNSAFE_OUTPUT: RegExp[] = [
  /\b(porn|sex|erotik|nackt|nudes)\b/i,
  /\b(selbstmord|suizid|ritz(en|e)|umbringen)\b/i,
  /\b(kokain|heroin|cannabis kaufen|drogen kaufen)\b/i,
  /\b(bombe bauen|sprengsatz|waffe bauen)\b/i,
  /\b(triff mich|schick mir ein foto|nicht deinen eltern|sag es niemandem)\b/i,
]

export type OutputVerdict =
  | { ok: true; text: string }
  | { ok: false; text: string; matched: string }

const NEUTRAL_REPLY =
  "Darüber rede ich mit dir nicht. Das ist eine Frage für Papa — geh zu ihm, er erklärt es dir besser als ich."

/**
 * Checks a reply before it renders.
 *
 * On a trip it returns a neutral in-character message rather than an error,
 * and reports what matched so the caller can file it to the parent deck. The
 * child sees a boundary; the parent sees the reason.
 */
export function checkOutput(raw: string): OutputVerdict {
  for (const pattern of UNSAFE_OUTPUT) {
    const match = raw.match(pattern)
    if (match) {
      return { ok: false, text: NEUTRAL_REPLY, matched: match[0] }
    }
  }
  return { ok: true, text: raw }
}

/**
 * The safety prompt, on every station.
 *
 * Prepended to whatever the station's own scaffold says, never replaced by
 * it — a station author cannot accidentally drop the rules by writing a
 * system prompt of their own in the content JSON.
 */
export const BASE_SYSTEM = `Du sprichst mit einem zehnjährigen Kind auf Deutsch, per du.

Regeln, die immer gelten:
- Kurze Sätze. Aktive Sprache. Keine Ausrufezeichen.
- Erkläre so, dass eine Zehnjährige es versteht, aber rede nicht wie mit einem Kleinkind.
- Du machst keine Hausaufgaben. Wenn sie nach einer Hausaufgabe fragt, sag freundlich nein und
  biete stattdessen an, zu erklären, wie man selbst darauf kommt.
- Du fragst nie nach Namen, Adresse, Schule, Telefonnummer oder anderen persönlichen Daten.
  Wenn sie dir welche erzählt, gehst du nicht darauf ein.
- Nichts Gruseliges, nichts Gewalttätiges, nichts Romantisches, nichts Sexuelles.
- Bei allem Schweren oder Traurigen: sag, dass sie mit Papa reden soll.
- Du hast kein Internet. Wenn du etwas nicht weisst, sagst du das.`

/** The extra line each station type adds on top of the base rules. */
const STATION_SYSTEM: Record<StationType, string> = {
  talk: "Du bist ein ruhiger, neugieriger Begleiter. Stell auch mal eine Rückfrage.",
  // Deliberately not "be wrong" — instructing a model to lie to a child is a
  // different thing from letting a weak model be itself. The station's value
  // comes from an honest attempt by a model that is not good enough.
  jagd: "Antworte direkt und knapp auf die Frage, so gut du kannst. Rate nicht offen herum.",
  zoo: "Antworte knapp, höchstens fünf Sätze.",
  labor: "Folge dem Prompt genau. Erfinde keine zusätzlichen Aufgaben.",
  werkstatt:
    "Du baust kleine Web-Spielzeuge als eine einzige HTML-Datei. Kein Text ausserhalb des Codes.",
  echt: "Erkläre, woran man erkennt, ob ein Bild echt oder erzeugt ist.",
  quiz: "Bewerte kurz und freundlich, ob die Antwort stimmt.",
}

export function systemFor(station: StationType, scaffold?: string): string {
  return [BASE_SYSTEM, STATION_SYSTEM[station], scaffold?.trim()].filter(Boolean).join("\n\n")
}

/**
 * Whether a message is her asking the app to do her homework.
 *
 * The curriculum says the app refuses homework; the spec says the app should
 * enforce that rather than rely on her honesty. The system prompt asks the
 * model to refuse, and this catches the obvious cases before a call happens
 * at all, so a weak model on `jagd` cannot cheerfully comply.
 */
// No \b anchors: JavaScript's word boundary is ASCII-only, so "\bübersetze"
// never matches because "ü" is not a word character — and "\bhausaufgabe\b"
// would miss the plural "Hausaufgaben". Both are exactly the phrasings a
// German-speaking child uses, so the boundaries would have made the check
// look right and do nothing.
const HOMEWORK =
  /(hausaufgabe|hausis|referat|aufsatz schreiben|löse (die|diese|meine) aufgabe|rechne (das|die) aus|übersetze (den|diesen|meinen) text|inhaltsangabe)/i

export function looksLikeHomework(text: string): boolean {
  return HOMEWORK.test(text)
}

export const HOMEWORK_REPLY =
  "Hausaufgaben mache ich nicht — das ist deine Arbeit, nicht meine. Wenn du willst, erkläre ich dir, wie man an so eine Aufgabe rangeht."
