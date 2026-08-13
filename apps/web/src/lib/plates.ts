/**
 * The plates for "Echt oder Fake?" — their facts, without their drawings.
 *
 * The spec asked for six images generated on the fly by `flux-1-schnell`. The
 * gateway speaks the Anthropic messages format and has no image endpoint
 * behind it, so there is nothing to call — and rather than ship a station that
 * depends on a service that does not exist, these are authored scenes carrying
 * the exact mistakes an image model makes: a sixth finger, letters that are
 * nearly words, two light sources, a mirror that disagrees with the room.
 *
 * They are presented as *Schaubilder* — diagrams — and the question is "does
 * this add up?", not "is this a real photo". Asking a ten-year-old whether an
 * obvious line drawing is a photograph would train her to detect drawings,
 * which is not the skill. The skill is systematic looking: hands, text,
 * physics, light, count. The transfer to her own feed is the debrief's job,
 * and the debrief says so in as many words.
 *
 * Two of the six are sound, so "everything is fake" is not a winning strategy.
 * Adding plates means keeping roughly that ratio — `plates.test.ts` checks it.
 *
 * The drawings live in components/plate-art.tsx. The split is so this file can
 * be unit-tested without a JSX runtime, and so swapping in a real image lane
 * later touches the art and not the curriculum.
 */

export type Tell = {
  /** Where the marker sits, in percent of the plate box. */
  x: number
  y: number
  label: string
}

export type Plate = {
  id: string
  /** True when something in the scene does not add up. */
  flawed: boolean
  /** Read by screen readers, and the whole content of the plate when SVG is off. */
  alt: string
  /** Revealed after she answers. Empty for a sound plate. */
  tells: Tell[]
  /** One line, after the answer. What to look at next time. */
  lesson: string
}

export const PLATES: Plate[] = [
  {
    id: "haende",
    flawed: true,
    alt: "Eine Hand, die einen Becher hält. An der Hand sind sechs Finger.",
    lesson: "Hände zuerst. Finger nachzählen kostet zwei Sekunden und verrät die meisten Bilder.",
    tells: [{ x: 62, y: 30, label: "Sechs Finger" }],
  },
  {
    id: "hafenfoto",
    flawed: false,
    alt: "Ein Segelboot am Steg. Mast, Segel, Steg und Spiegelung passen zusammen.",
    lesson:
      "Hier stimmt alles: ein Licht, eine Spiegelung darunter, der Steg steht im Wasser. Nicht jedes Bild hat einen Fehler.",
    tells: [],
  },
  {
    id: "marktschild",
    flawed: true,
    alt: "Ein Marktstand mit einem Schild. Darauf steht BÄCKREEI und darunter FRSICH ROTT.",
    lesson:
      "Schrift lesen, nicht nur sehen. Buchstaben, die fast ein Wort ergeben, sind das deutlichste Zeichen von allen.",
    tells: [
      { x: 50, y: 27, label: "BÄCKREEI" },
      { x: 50, y: 41, label: "FRSICH ROTT" },
    ],
  },
  {
    id: "stuhl",
    flawed: false,
    alt: "Ein Stuhl an einem Tisch. Beide stehen mit allen Beinen auf dem Boden, die Schatten fallen in dieselbe Richtung.",
    lesson:
      "Vier Beine, alle auf dem Boden, ein Licht von links. Wenn du nichts findest, hast du nicht zu wenig gesucht — dann ist nichts da.",
    tells: [],
  },
  {
    id: "schatten",
    flawed: true,
    alt: "Zwei Bäume nebeneinander. Ihre Schatten fallen in entgegengesetzte Richtungen, obwohl nur eine Sonne am Himmel steht.",
    lesson: "Licht kommt aus einer Richtung. Zwei Schatten, zwei Richtungen, eine Sonne — das geht nicht.",
    tells: [
      { x: 34, y: 82, label: "Schatten nach rechts" },
      { x: 62, y: 82, label: "Schatten nach links" },
    ],
  },
  {
    id: "spiegelung",
    flawed: true,
    alt: "Eine Katze sitzt vor einem Spiegel. Im Spiegel sitzt ein Hund.",
    lesson: "Spiegel und Scheiben prüfen. Ein Bildmodell malt beide Seiten einzeln und vergleicht nie.",
    tells: [{ x: 71, y: 44, label: "Falsches Spiegelbild" }],
  },
]

const BY_ID = new Map(PLATES.map((plate) => [plate.id, plate]))

export function plateById(id: string): Plate | undefined {
  return BY_ID.get(id)
}

/** Resolves the content's plate ids, dropping any that no longer exist. */
export function platesFor(ids: readonly string[]): Plate[] {
  return ids.map((id) => BY_ID.get(id)).filter((plate): plate is Plate => Boolean(plate))
}
