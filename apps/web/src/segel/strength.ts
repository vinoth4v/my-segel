/**
 * How strong a prompt looks, scored without asking a model.
 *
 * Four levers, four points, arithmetic. Two reasons it is not a model call:
 * it has to update as she types, and a model scoring her prompt would be one
 * more oracle to trust in an app whose entire subject is not trusting
 * oracles. She is told it is arithmetic — that is a small lesson of its own.
 */

export type Strength = { value: number; missing: string[] }

const LEVERS: { label: string; test: RegExp }[] = [
  // Who should answer — a role, a persona, an audience.
  {
    label: "wer",
    test: /\b(als|wie ein[e]?|für ein[e]?|du bist|antworte als|stell dir vor,? du)\b/i,
  },
  // What exactly — a question word or a concrete noun phrase beats "was über".
  {
    label: "was genau",
    test: /\b(warum|wieso|wie genau|was passiert|erklär mir,? (warum|wie|was)|der unterschied)\b/i,
  },
  // What not — the constraint that keeps an answer on target.
  { label: "was nicht", test: /\b(ohne|keine?n?\s|nicht länger|verzichte|vermeide)\b/i },
  // How long — any explicit budget. Spelled-out numbers count: a ten-year-old
  // writes "vier Sätze", not "4 Sätze", and a digits-only test would score
  // her correct prompt as missing a lever.
  {
    label: "wie lang",
    test: /((\d+|ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*(sätze|satz|wörter|punkte|zeilen|absätze)|höchstens|maximal|kurz(er)? absatz|in einem satz)/i,
  },
]

export function promptStrength(prompt: string): Strength {
  const text = prompt.trim()
  if (!text) return { value: 0, missing: LEVERS.map((lever) => lever.label) }

  const missing = LEVERS.filter((lever) => !lever.test.test(text)).map((lever) => lever.label)
  const hit = LEVERS.length - missing.length

  // Length alone is not strength — a rambling prompt with no levers should
  // not creep up the bar — so the score is the levers, full stop, with a
  // small floor so an empty-looking meter does not read as broken.
  const value = hit / LEVERS.length

  return { value: Math.max(value, text.length > 12 ? 0.08 : 0), missing }
}
