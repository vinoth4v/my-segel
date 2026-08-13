import type { Station } from "../content/schema.ts"

/**
 * The part of this app that is not negotiable.
 *
 * Three layers, and they do different jobs:
 *
 *   1. **Input filter** — catches personal data before it is sent anywhere.
 *      Regex, synchronous, no network. Blocks with an in-character message,
 *      because "Error: input rejected" teaches a ten-year-old that she broke
 *      something rather than that she was about to give away her address.
 *   2. **System prompt** — the standing brief on every single call, with the
 *      station's own scaffold appended rather than replacing it. A station
 *      cannot opt out of the safety rules by defining its own prompt.
 *   3. **Output filter** — checked before anything renders. On a trip the
 *      answer is replaced wholesale, not edited, and the parent deck gets the
 *      original.
 *
 * The regexes are deliberately blunt and will sometimes block something
 * harmless. That trade is the right way round here: a false block costs her
 * one retyped sentence, and a miss costs her address.
 */

export type Verdict =
  | { allowed: true }
  | { allowed: false; reason: PersonalDataKind; message: string }

export type PersonalDataKind =
  | "phone"
  | "email"
  | "address"
  | "postcode"
  | "school"
  | "full-name"
  | "birthdate"
  | "credentials"

/** Friendly, in character, and specific enough that she knows what to change. */
const BLOCK_MESSAGES: Record<PersonalDataKind, string> = {
  phone: "Telefonnummern bleiben an Bord. Nimm die Nummer raus, dann geht es weiter.",
  email: "E-Mail-Adressen gehören nicht ins Gespräch. Schreib die Frage ohne sie nochmal.",
  address: "Wo du wohnst, geht das Modell nichts an. Lass die Adresse weg.",
  postcode: "Postleitzahl und Ort bleiben hier. Frag nochmal ohne.",
  school: "Deine Schule bleibt unter uns. Formulier es ohne den Namen.",
  "full-name": "Namen behalten wir für uns — deinen und die von anderen. Nimm ihn raus.",
  birthdate: "Geburtsdaten bleiben an Bord. Ohne das Datum geht es weiter.",
  credentials: "Passwörter schreibt man nirgendwo hin. Auch hier nicht.",
}

/**
 * Ordered because the first match wins and the message should name the most
 * specific thing found. Each entry is one recognisable shape, not a mood.
 */
const PATTERNS: { kind: PersonalDataKind; pattern: RegExp }[] = [
  { kind: "email", pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  {
    kind: "credentials",
    pattern: /\b(passwort|password|pin|kennwort)\b\s*(ist|lautet|=|:)/i,
  },
  // German mobile and landline shapes, plus any bare run of 7+ digits, which
  // is a phone number often enough to be worth the occasional false block.
  { kind: "phone", pattern: /(\+49|\b0)[\d\s/-]{7,}\d/ },
  { kind: "phone", pattern: /\b\d{7,}\b/ },
  {
    kind: "address",
    pattern: /\b[a-zäöüß]+(stra(ß|ss)e|str\.|weg|allee|gasse|platz|ring|damm)\s*\d/i,
  },
  { kind: "address", pattern: /\bich wohne (in|an|bei)\b/i },
  { kind: "postcode", pattern: /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/ },
  {
    kind: "school",
    pattern: /\b(gymnasium|grundschule|realschule|gesamtschule|schule)\s+[A-ZÄÖÜ][\wäöüß-]+/i,
  },
  { kind: "school", pattern: /\bich gehe (in|auf) die\b/i },
  { kind: "birthdate", pattern: /\b\d{1,2}\.\d{1,2}\.(19|20)\d{2}\b/ },
  {
    kind: "full-name",
    pattern: /\b(ich hei(ß|ss)e|mein name ist|mein nachname|meine adresse)\b/i,
  },
]

/**
 * Checks what she typed before it leaves the server.
 *
 * Synchronous and offline on purpose: this runs on the hot path of every
 * message, and a safety check that depends on the network is a safety check
 * that fails open when the network does.
 */
export function checkInput(text: string): Verdict {
  for (const { kind, pattern } of PATTERNS) {
    if (pattern.test(text)) {
      return { allowed: false, reason: kind, message: BLOCK_MESSAGES[kind] }
    }
  }
  return { allowed: true }
}

/**
 * The standing brief, on every call to every station.
 *
 * Written as rules with reasons rather than a list of bans, because models
 * follow a rule they understand and route around one they do not. The homework
 * refusal is a curriculum decision, not a safety one — it is in here because
 * the app should enforce it rather than rely on her honesty about what the
 * work is for.
 */
export const BASE_SYSTEM_PROMPT = `Du bist Segel, ein ruhiger, freundlicher Begleiter für ein zehnjähriges Kind, das gerade lernt, wie KI funktioniert. Die Anrede ist "du".

So schreibst du:
- Kurze Sätze, aktive Sprache, keine Fachwörter ohne Erklärung.
- Keine Ausrufezeichen. Lob nur, wenn es einen Grund gibt, und dann in einem Satz.
- Drei bis fünf Sätze pro Antwort, wenn nicht ausdrücklich anders verlangt.
- Kein Emoji-Regen, keine Anbiederung, keine Wortspiele um jeden Preis.

Diese Regeln gelten immer und gehen allem anderen vor:
1. HAUSAUFGABEN: Du erledigst keine Hausaufgaben und schreibst keine Texte, die sie als eigene Arbeit abgeben könnte. Wenn danach gefragt wird, sag freundlich nein und erkläre stattdessen den Weg — eine Frage zurückstellen, ein Beispiel zeigen, einen Begriff erklären. Das ist keine Strenge, das ist der Sinn des Kurses.
2. PERSÖNLICHE DATEN: Du fragst nie nach Name, Adresse, Schule, Telefonnummer, E-Mail oder Fotos. Wenn sie so etwas von sich aus schreibt, gehst du nicht darauf ein und sagst kurz, dass so etwas nicht ins Gespräch gehört.
3. SCHWERE THEMEN: Bei allem Belastendem — Angst, Streit, Krankheit, Tod, Gewalt, Sucht, alles Sexuelle oder Romantische — antwortest du nicht inhaltlich. Du sagst in einem Satz, dass das etwas für Papa ist, und fragst, ob sie ihn dazuholen will.
4. NICHTS ERSCHRECKENDES: Keine Gruselgeschichten, keine Bedrohungsszenarien, keine Beschreibungen von Verletzungen.
5. EHRLICHKEIT ÜBER DICH SELBST: Du hast kein Internet und schlägst nichts nach. Wenn du etwas nicht sicher weißt, sagst du das, statt eine glaubhafte Antwort zu bauen. Wenn sie dich bei einem Fehler erwischt, gibst du ihn ohne Umschweife zu — genau das soll sie üben.`

/** The station's own brief, appended so it can narrow the rules but never widen them. */
export function systemPromptFor(station: Station): string {
  const scaffold =
    station.type === "talk" || station.type === "jagd" ? station.systemScaffold : undefined

  return scaffold ? `${BASE_SYSTEM_PROMPT}\n\n--- Diese Station ---\n${scaffold}` : BASE_SYSTEM_PROMPT
}

/**
 * Categories the answer must not contain, checked before render.
 *
 * Short and unambiguous by design. A long list of emotive words would trip on
 * ordinary curriculum text — the hunt asks about a marten's diet, the media
 * voyage talks about what is real — and an output filter that cries wolf gets
 * switched off. These are strings that have no innocent reading in a reply
 * addressed to a ten-year-old.
 */
const OUTPUT_PATTERNS: { label: string; pattern: RegExp }[] = [
  {
    label: "personal-data-request",
    pattern:
      /\b(wie hei(ß|ss)t du|wie ist dein name|wo wohnst du|deine adresse|deine telefonnummer|schick mir ein foto)\b/i,
  },
  { label: "romantic", pattern: /\b(ich liebe dich|verliebt in dich|k(ü|ue)ss mich)\b/i },
  {
    label: "self-harm",
    pattern: /\b(bring dich um|tu dir weh|ritzen|selbstmord|suizid)\b/i,
  },
  {
    label: "off-platform-contact",
    pattern: /\b(treffen wir uns|komm zu mir|sag es niemandem|erz(ä|ae)hl es keinem)\b/i,
  },
  { label: "sexual", pattern: /\b(sex|nackt|porno)\b/i },
]

export type OutputVerdict = { safe: true } | { safe: false; label: string; replacement: string }

/** What she sees instead. Neutral, no drama, and it does not invite a retry of the same thing. */
const OUTPUT_REPLACEMENT =
  "Diese Antwort habe ich zurückgehalten. Sie passt nicht hierher. Frag etwas anderes, oder hol Papa dazu."

export function checkOutput(text: string): OutputVerdict {
  for (const { label, pattern } of OUTPUT_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, label, replacement: OUTPUT_REPLACEMENT }
    }
  }
  return { safe: true }
}

/**
 * Trims what she typed to something a station can carry.
 *
 * Not a safety rule so much as a cost and latency one, but it lives here
 * because it is the same hot path: an accidental paste of a whole book should
 * fail as a short message, not as a gateway bill.
 */
export const MAX_INPUT_CHARS = 1_000

export function tooLong(text: string): boolean {
  return text.length > MAX_INPUT_CHARS
}
