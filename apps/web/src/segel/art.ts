/**
 * The names of the drawings, as plain data.
 *
 * Separate from app/illustrations.tsx, which holds the SVG itself, so that a
 * unit test can check the curriculum against this list without importing JSX
 * into a node environment. The component file derives its lookup from this
 * list, so the two cannot drift: a voyage naming a drawing that does not
 * exist is a failing test rather than a silently empty header.
 */
export const ART_NAMES = [
  "was-ist-das-ding",
  "die-jagd",
  "der-zoo",
  "das-prompt-labor",
  "die-werkstatt",
  "echt-oder-fake",
  "trainingsdaten",
  "verzerrung",
  "urheberrecht",
  "agenten",
  "privatsphaere",
] as const

export type ArtName = (typeof ART_NAMES)[number]

export function isArtName(name: string): name is ArtName {
  return (ART_NAMES as readonly string[]).includes(name)
}
