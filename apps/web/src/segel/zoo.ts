import { describeModel, type ModelProfile } from "@/segel/router"

/**
 * The Modell-Zoo's letter↔model bookkeeping.
 *
 * Which model is behind A, B and C exists in exactly one place: the transcript
 * rows the round already wrote, each carrying its letter and the `servedBy`
 * the gateway reported. The browser is never sent the mapping until it posts a
 * ranking, and the reveal reads it back from here.
 *
 * The names come from what actually answered rather than from a table of what
 * we hoped would answer. That distinction is the whole reason this file
 * exists — the previous version asked for three model names the gateway does
 * not support, was served the same model three times, and told her they were
 * three different ones.
 */

/**
 * Marks the letter at the start of a Zoo transcript row.
 *
 * Not "[A]": that could plausibly appear in a model's own answer, and then the
 * reveal would parse a letter out of the model's prose. This cannot.
 */
export const LETTER_TAG = "⎈ "

export type RevealedModel = ModelProfile & { letter: string; servedBy: string }

type Row = { content: string; servedBy: string | null; at: Date }

/**
 * Pairs each letter with the model that actually served it.
 *
 * Takes the station's most recent `modell` rows, newest first. A round always
 * writes exactly three, so the newest three are this round's — including any
 * that failed, which is what keeps the letters aligned when one model times
 * out.
 */
export function pairLettersToModels(rows: readonly Row[]): Map<string, RevealedModel> {
  const paired = new Map<string, RevealedModel>()

  for (const row of rows) {
    if (!row.content.startsWith(LETTER_TAG)) continue

    const letter = row.content.slice(LETTER_TAG.length, LETTER_TAG.length + 1)
    if (!/^[A-C]$/.test(letter)) continue
    // Newest first, so the first sighting of a letter is this round's.
    if (paired.has(letter)) continue

    const servedBy = row.servedBy ?? ""
    paired.set(letter, { letter, servedBy, ...describeModel(servedBy) })

    if (paired.size === 3) break
  }

  return paired
}

/**
 * How many genuinely different models answered this round.
 *
 * Counted on `servedBy`, not on the friendly name. A lane serves a *chain*
 * rather than a fixed model — observed live, one round returned
 * `laguna-xs-2.1` and another `laguna-s-2.1` — and those are two different
 * models that happen to share a family. Counting by name would call that
 * round collapsed and tell her the same machine wrote both, which is its own
 * small lie in the opposite direction.
 *
 * Fewer than two distinct means the roster really did collapse onto one
 * model, and the reveal says so rather than naming three.
 */
export function distinctModelCount(revealed: readonly RevealedModel[]): number {
  return new Set(revealed.map((entry) => entry.servedBy).filter(Boolean)).size
}
