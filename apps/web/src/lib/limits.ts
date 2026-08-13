import { readSettings, touchSession } from "../db/segel.ts"

/**
 * The caps, enforced on the server.
 *
 * The anti-metric in the spec is time in app: two hours in here is a failure,
 * not engagement. So the caps are not a parental control bolted on the side —
 * they are the app's own opinion about what a good session looks like, and
 * they are checked in the route handlers rather than in the browser, because
 * anything checked in the browser is a suggestion.
 *
 * All three are editable from the Kapitäns-Deck without a deploy.
 */

export const SETTING_KEYS = {
  sessionCap: "session_cap_minutes",
  dayCap: "day_cap_minutes",
  killSwitch: "kill_switch",
} as const

export const DEFAULTS = {
  /** From the spec. Long enough for any single voyage, short enough to end. */
  sessionCapMinutes: 40,
  /** Two sessions in a day is already more than the curriculum asks for. */
  dayCapMinutes: 80,
} as const

export type Limits = {
  sessionCapMinutes: number
  dayCapMinutes: number
  killSwitch: boolean
}

export async function limits(): Promise<Limits> {
  const settings = await readSettings()
  return {
    sessionCapMinutes: positiveNumber(
      settings[SETTING_KEYS.sessionCap],
      DEFAULTS.sessionCapMinutes,
    ),
    dayCapMinutes: positiveNumber(settings[SETTING_KEYS.dayCap], DEFAULTS.dayCapMinutes),
    killSwitch: settings[SETTING_KEYS.killSwitch] === "on",
  }
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export type Gate =
  | { open: true; sessionMinutes: number; sessionCapMinutes: number }
  | { open: false; message: string }

/**
 * Called at the top of every station request.
 *
 * Touching the session window and checking the caps are one operation on
 * purpose: a check that does not also record the time can be passed forever by
 * a client that never reports anything.
 *
 * The refusal messages are written to her, in character, and say when she can
 * come back — a cap that reads as a malfunction gets treated as one.
 */
export async function gate(): Promise<Gate> {
  const [config, used] = await Promise.all([limits(), touchSession()])

  if (config.killSwitch) {
    return {
      open: false,
      message: "Segel ist gerade geschlossen. Papa hat den Schalter umgelegt — frag ihn.",
    }
  }

  if (used.dayMinutes >= config.dayCapMinutes) {
    return {
      open: false,
      message: "Für heute ist Schluss. Das Logbuch bleibt offen, weiterfahren kannst du morgen.",
    }
  }

  if (used.sessionMinutes >= config.sessionCapMinutes) {
    return {
      open: false,
      message:
        "Diese Sitzung ist zu Ende. Steh auf, mach etwas anderes, komm in einer Viertelstunde wieder.",
    }
  }

  return {
    open: true,
    sessionMinutes: used.sessionMinutes,
    sessionCapMinutes: config.sessionCapMinutes,
  }
}
