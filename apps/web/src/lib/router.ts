import type { StationType } from "../content/schema.ts"

/**
 * Which model answers which station, and why.
 *
 * The reason this app is worth building on the gateway rather than on one
 * provider: the stations want genuinely different models, and one of them
 * wants a *bad* one. `jagd` is the whole curriculum's core week, and it works
 * because a small model is confidently wrong — routing it to a strong model
 * would quietly delete the lesson. That is the single most important line in
 * this file, and the easiest one to "fix" by accident.
 *
 * Two ways to name a model, in order of preference:
 *
 *   1. A **lane** — `kompass-fast`, `kompass-simple`, and so on. The gateway
 *      picks the concrete model, handles quota and cools down what is busy.
 *      This is the default for every station, so the app keeps working when
 *      the roster changes underneath it, which it will.
 *   2. A **pin** — `kompass:<provider>/<model>`, read from the environment.
 *      Only for the two places where the exact model is pedagogy rather than
 *      preference: the weak model in `jagd`, and `labor`, where both sides
 *      must be identical or the comparison is meaningless.
 *
 * Pins live in the environment rather than in this file because the roster is
 * the gateway's business, not the app's — pinning `gpt-oss-120b` in code means
 * a deploy the day it is retired.
 */

export type Lane =
  | "kompass-fast"
  | "kompass-simple"
  | "kompass-agentic"
  | "kompass-hard"
  | "kompass-longctx"

export type Route = {
  /** What goes in the request's `model` field: a lane alias or a pin. */
  model: string
  /** Shown on the Kapitäns-Deck, never to her mid-station. */
  label: string
  /** Anything slower than this is a failed session, not a slow one. */
  timeoutMs: number
  maxTokens: number
}

/** Beyond this, a ten-year-old has stopped waiting and gone to do something else. */
const STATION_TIMEOUT_MS = 20_000

/**
 * The env var that may pin each station, when the default lane is not enough.
 * Absent means "let the gateway route", which is the supported state — none of
 * these need to be set for the app to work.
 */
const PIN_VARS = {
  talk: "SEGEL_PIN_TALK",
  jagd: "SEGEL_PIN_JAGD",
  labor: "SEGEL_PIN_LABOR",
  werkstatt: "SEGEL_PIN_WERKSTATT",
  quiz: "SEGEL_PIN_GRADE",
  echt: "SEGEL_PIN_GRADE",
  zoo: "SEGEL_PIN_ZOO",
} as const satisfies Record<StationType, string>

/** Read lazily, never at module scope — `next build` must not need any of it. */
function pin(station: StationType): string | undefined {
  const value = process.env[PIN_VARS[station]]?.trim()
  return value ? value : undefined
}

const DEFAULTS: Record<StationType, { lane: Lane; label: string; maxTokens: number }> = {
  // Open conversation with a child. The one station where instruction-following
  // on the safety prompt *is* the product, so it gets the lane built for
  // careful, quick replies rather than the cheapest one available.
  talk: { lane: "kompass-fast", label: "Gespräch", maxTokens: 700 },

  // Deliberately the weakest lane in the roster. See above: this is a feature.
  jagd: { lane: "kompass-simple", label: "Jagd (schwaches Modell)", maxTokens: 600 },

  // Overridden per column by zooRoutes(); this is only the fallback shape.
  zoo: { lane: "kompass-fast", label: "Zoo", maxTokens: 500 },

  // Pinned, and identical on both sides — enforced by laborRoute() returning
  // one route that the caller uses twice, rather than two routes that happen
  // to match today.
  labor: { lane: "kompass-simple", label: "Labor", maxTokens: 700 },

  // Code generation. Escalates on a render failure; see gateway.ts.
  werkstatt: { lane: "kompass-agentic", label: "Werkstatt", maxTokens: 4000 },

  // Grading her answers and describing tells. Low stakes, small and free.
  quiz: { lane: "kompass-simple", label: "Auswertung", maxTokens: 400 },
  echt: { lane: "kompass-simple", label: "Auswertung", maxTokens: 400 },
}

export function route(station: StationType): Route {
  const base = DEFAULTS[station]
  return {
    model: pin(station) ?? base.lane,
    label: base.label,
    timeoutMs: STATION_TIMEOUT_MS,
    maxTokens: base.maxTokens,
  }
}

/**
 * Three routes for the zoo, which must be three genuinely different models or
 * the station teaches nothing.
 *
 * By default they are three different lanes, because the gateway maps lanes to
 * different concrete models — and the reveal then reports what actually served
 * each column, read off the response header, rather than what this file
 * guessed. That is why the zoo survives a roster change that would break a
 * hardcoded trio.
 *
 * `SEGEL_PIN_ZOO` overrides with a comma-separated list when you want a
 * specific line-up.
 */
export function zooRoutes(): [Route, Route, Route] {
  const pinned = pin("zoo")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

  const lanes: Lane[] = ["kompass-fast", "kompass-simple", "kompass-agentic"]
  const models = [0, 1, 2].map((index) => pinned?.[index] ?? lanes[index] ?? "kompass-fast")

  return [
    { model: models[0] ?? "kompass-fast", label: "A", timeoutMs: 8_000, maxTokens: 500 },
    { model: models[1] ?? "kompass-simple", label: "B", timeoutMs: 8_000, maxTokens: 500 },
    { model: models[2] ?? "kompass-agentic", label: "C", timeoutMs: 8_000, maxTokens: 500 },
  ]
}

/**
 * One route, used for both halves of the prompt lab.
 *
 * Returning a single value is the point. If her prompt and the assembled
 * prompt ran on different models, the comparison would measure the models and
 * she would learn the wrong lesson — and two separate `route("labor")` calls
 * would silently start differing the day someone adds rotation. So there is
 * exactly one call site's worth of route here.
 */
export function laborRoute(): Route {
  return route("labor")
}

/**
 * Where a failed call goes next.
 *
 * The rule from the spec: one retry on a different free model, then escalate.
 * `jagd` is the exception and never escalates — a strong model rescuing a weak
 * one is precisely the failure this station is built to show her.
 */
export function fallbackFor(station: StationType, attempt: number): Route | undefined {
  if (station === "jagd") return undefined

  const base = route(station)
  if (attempt === 0) return { ...base, model: "kompass-fast" }
  if (attempt === 1) return { ...base, model: "kompass-hard", label: `${base.label} (eskaliert)` }
  return undefined
}
