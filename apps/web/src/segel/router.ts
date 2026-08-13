import { type AskOptions, ask, type Message } from "@/kompass"

/**
 * Which model serves which station, and what happens when it does not answer.
 *
 * This file exists because Segel's stations want genuinely different models,
 * and for two of them the model choice *is* the lesson rather than an
 * implementation detail:
 *
 *   - `jagd` wants a weak, confident model. Being wrong is the pedagogy. A
 *     helpful upgrade to a stronger model would silently delete the week.
 *   - `labor` must run the same model on both halves of the comparison. If
 *     the model varies, the comparison measures the model instead of her
 *     prompt, and the station teaches nothing.
 *   - `zoo` wants three *different* models, named, so "the AI" visibly stops
 *     being one thing.
 *
 * Everywhere else a lane alias is correct and the gateway should choose.
 */

export const STATION_TYPES = ["talk", "jagd", "zoo", "labor", "werkstatt", "echt", "quiz"] as const

export type StationType = (typeof STATION_TYPES)[number]

/**
 * Pinned model names, passed through to the gateway verbatim.
 *
 * Deliberately in one place: a pin is a promise about behaviour, and a pin
 * scattered through route handlers is a pin nobody can audit. Each is tried
 * first and falls back to its lane — a name the gateway no longer serves must
 * degrade to a working answer, never to a broken station in front of a child.
 */
export const PINS = {
  /** Weak-and-confident, which is exactly what Die Jagd needs. */
  jagd: "kompass:openai/gpt-oss-120b",
  /** One mid-tier model, both halves of the Prompt-Labor. */
  labor: "kompass:deepseek/deepseek-v3.2",
  /** The Modell-Zoo's roster. Three are drawn per round. */
  zoo: [
    "kompass:google/gemini-3.6-flash",
    "kompass:deepseek/deepseek-v3.2",
    "kompass:zhipu/glm-5.2",
    "kompass:minimax/minimax-m3",
    "kompass:nvidia/nemotron-3-super",
  ],
  /** Code-capable free models for the Werkstatt, before escalation. */
  werkstatt: ["kompass:qwen/qwen3-coder-next", "kompass:mistral/devstral-medium"],
} as const

/** What the picker shows once she has ranked the three and the names appear. */
export const ZOO_PROFILES: Record<string, { name: string; origin: string; size: string }> = {
  "kompass:google/gemini-3.6-flash": { name: "Gemini Flash", origin: "Google, USA", size: "gross" },
  "kompass:deepseek/deepseek-v3.2": {
    name: "DeepSeek",
    origin: "DeepSeek, China",
    size: "sehr gross",
  },
  "kompass:zhipu/glm-5.2": { name: "GLM", origin: "Zhipu, China", size: "gross" },
  "kompass:minimax/minimax-m3": { name: "MiniMax", origin: "MiniMax, China", size: "mittel" },
  "kompass:nvidia/nemotron-3-super": { name: "Nemotron", origin: "NVIDIA, USA", size: "mittel" },
}

export type Route = {
  /** Tried first. Absent means "let the gateway route the lane". */
  model?: string
  lane: AskOptions["lane"]
  maxTokens: number
}

/**
 * The route for a station type.
 *
 * `talk` is the one place not to economise: it is open-ended conversation
 * with a ten-year-old, and instruction-following on the safety prompt is the
 * product rather than a nice-to-have. It therefore gets a lane rather than a
 * pin, so the gateway always has a working model to fall back through.
 */
export function route(station: StationType): Route {
  switch (station) {
    case "talk":
      return { lane: "kompass-agentic", maxTokens: 700 }
    case "jagd":
      return { model: PINS.jagd, lane: "kompass-simple", maxTokens: 500 }
    case "labor":
      return { model: PINS.labor, lane: "kompass-fast", maxTokens: 700 }
    case "zoo":
      return { lane: "kompass-fast", maxTokens: 500 }
    case "werkstatt":
      return { model: PINS.werkstatt[0], lane: "kompass-agentic", maxTokens: 4000 }
    case "echt":
    case "quiz":
      return { lane: "kompass-simple", maxTokens: 400 }
  }
}

/** Anything the gateway did that the Kapitäns-Deck should be able to see. */
export type CallRecord = {
  model: string
  lane: string
  servedBy: string
  /** True when the first choice failed and something else answered. */
  escalated: boolean
  /** Why it escalated, for the parent deck. Empty when it did not. */
  escalationReason: string
  inputTokens: number
  outputTokens: number
}

export type Reply = { text: string; call: CallRecord }

/** Over this, a free model is not coming back and the station has stalled. */
const TIMEOUT_MS = 20_000

/**
 * One model call with the fallback rule applied.
 *
 * The rule from the spec: a call that errors, times out, or comes back empty
 * retries once on a different free model, then escalates to a lane the
 * gateway can serve from its strongest chain. Every escalation is recorded,
 * so the free-to-paid ratio stays visible in the parent deck instead of
 * quietly drifting.
 *
 * `jagd` is exempt from the *quality* half of that rule on purpose. A wrong
 * answer there is a success, so only a hard failure — no answer at all —
 * triggers a retry.
 */
export async function callStation(
  station: StationType,
  messages: readonly Message[],
  options: { system?: string; overrideModel?: string; maxTokens?: number } = {},
): Promise<Reply> {
  const base = route(station)
  const first = options.overrideModel ?? base.model
  const maxTokens = options.maxTokens ?? base.maxTokens

  const attempts: { model?: string; reason: string }[] = [
    { model: first, reason: "" },
    // A different free model, per the fallback rule — not the same one again,
    // which would only re-run the failure.
    { model: alternate(station, first), reason: "erste Wahl hat nicht geantwortet" },
    // Last resort: no pin at all, so the gateway routes the lane itself.
    { model: undefined, reason: "beide freien Modelle sind ausgefallen" },
  ]

  let lastError = ""

  for (const [index, attempt] of attempts.entries()) {
    if (index > 0 && attempt.model === attempts[index - 1]?.model) continue

    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    try {
      const answer = await ask(messages, {
        ...(attempt.model ? { model: attempt.model } : {}),
        lane: base.lane,
        maxTokens,
        ...(options.system ? { system: options.system } : {}),
        signal: timeout,
      })

      if (!answer.text.trim()) {
        lastError = "leere Antwort"
        continue
      }

      return {
        text: answer.text,
        call: {
          model: attempt.model ?? base.lane ?? "kompass-agentic",
          lane: answer.lane,
          servedBy: answer.servedBy,
          escalated: index > 0,
          escalationReason: index > 0 ? `${attempt.reason} (${lastError})` : "",
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
        },
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(`Kein Modell hat geantwortet: ${lastError}`)
}

/** The second choice for a station, given what was tried first. */
function alternate(station: StationType, tried: string | undefined): string | undefined {
  if (station === "werkstatt") {
    return PINS.werkstatt.find((model) => model !== tried) ?? undefined
  }
  // Elsewhere the pin is the requirement, so the retry drops it rather than
  // swapping in a model that would invalidate the station.
  return undefined
}

/**
 * Three models for one Zoo round, chosen without repeats.
 *
 * Seeded by the round number rather than randomly so a reload shows her the
 * same three — a blind ranking she can refresh her way out of is not a
 * ranking.
 */
export function zooTrio(seed: number): string[] {
  const roster = [...PINS.zoo]
  const picked: string[] = []
  for (let i = 0; i < 3; i += 1) {
    const index = (seed * 7 + i * 3 + i * i) % roster.length
    const [model] = roster.splice(index, 1)
    if (model) picked.push(model)
  }
  return picked
}
