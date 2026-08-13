/**
 * The design tokens. This file is the source of truth — the stylesheet is
 * generated from it, so never edit the two in parallel.
 *
 * Deliberately small. A token set you can hold in your head gets used; one
 * with four hundred entries gets ignored and worked around.
 */

/**
 * Raw values. Not for use in components — they carry no meaning, so a change
 * here is a change to "what colour is this", not "what is this colour for".
 *
 * The Segel palette is a harbour chart: nautical instrument, not cartoon
 * boat. Deep harbour navy as the night ground, aged chart paper by day,
 * signal orange for actions, brass for earned things, sea-glass for a
 * correct answer or a caught error.
 */
const scale = {
  navy: "#12263a",
  navyRaised: "#1b3349",
  navyLine: "#2b4a5e",
  paper: "#ede3d0",
  paperRaised: "#f6efe1",
  paperLine: "#d8c9ac",
  inkMuted: "#4e6172",
  paperMuted: "#9db0be",
  signalOrange: "#e8622c",
  signalOrangeDeep: "#c74a17",
  brass: "#c9a227",
  brassDeep: "#8f7419",
  seaGlass: "#5fa8a0",
  seaGlassDeep: "#3d7d75",
  flagRed: "#b3261e",
  flagRedSoft: "#e2685c",
} as const

/** Semantic colours. Each names a job, and carries a value per scheme. */
export const color = {
  bg: { light: scale.paper, dark: scale.navy },
  surface: { light: scale.paperRaised, dark: scale.navyRaised },
  fg: { light: scale.navy, dark: scale.paper },
  muted: { light: scale.inkMuted, dark: scale.paperMuted },
  border: { light: scale.paperLine, dark: scale.navyLine },
  accent: { light: scale.signalOrangeDeep, dark: scale.signalOrange },
  danger: { light: scale.flagRed, dark: scale.flagRedSoft },
  success: { light: scale.seaGlassDeep, dark: scale.seaGlass },
  // Earned things only — stamps in the Logbuch, finished voyages. If brass
  // starts decorating buttons it stops meaning anything.
  brass: { light: scale.brassDeep, dark: scale.brass },
} as const

export const space = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  12: "3rem",
} as const

export const radius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  full: "9999px",
} as const

export const fontSize = {
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.5rem",
  "2xl": "2rem",
} as const

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
} as const

export const fontFamily = {
  // Body: a high-legibility humanist sans at generous size — she reads
  // fluently but not fast.
  sans: "'Seravek', 'Avenir Next', 'Segoe UI', Verdana, system-ui, sans-serif",
  // Display: condensed grotesque, chart-label feel. Headings and station
  // names only.
  display:
    "'Avenir Next Condensed', 'Helvetica Neue Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

export type ColorToken = keyof typeof color
export type SpaceToken = keyof typeof space
export type RadiusToken = keyof typeof radius
export type FontSizeToken = keyof typeof fontSize
export type FontWeightToken = keyof typeof fontWeight
export type FontFamilyToken = keyof typeof fontFamily
