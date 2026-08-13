import { ask, type Lane, type Message } from "@/kompass"

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
 * Lanes, not pinned model names.
 *
 * An earlier version of this file asked the gateway for names like
 * `kompass:google/gemini-3.6-flash`. **The gateway does not support that.**
 * `GET /v1/models` returns only the six lane aliases, and an unknown model
 * name is not rejected — it answers 200 and is quietly served by the default
 * lane. Three "different" models therefore came back from one model, and the
 * Modell-Zoo went on to reveal them to a ten-year-old under three invented
 * names. The station whose subject is "models disagree, so check" was
 * fabricating its own evidence.
 *
 * Nothing detected it because nothing failed: no error, no timeout, no empty
 * reply, so the fallback ladder never fired and the tests — which only
 * asserted what was *sent* — stayed green.
 *
 * So the roster is lanes, which really do resolve to different models, and
 * the names shown to her come from the gateway's own `x-kompass-served-by`
 * header rather than from a table written here. A table can drift out of
 * truth; the header is what actually answered.
 */
export const LANE_ROSTER = [
  "kompass-fast",
  "kompass-agentic",
  "kompass-hard",
  "kompass-longctx",
] as const satisfies readonly Lane[]

/**
 * Two lanes served by the same model must never appear in one Zoo round.
 *
 * `kompass-fast` and `kompass-simple` both resolve to gpt-oss-120b today, so
 * drawing both would put the same model on the table twice under two letters —
 * a subtler version of the bug this file already had once. `kompass-simple` is
 * therefore absent from the roster above rather than merely deprioritised.
 */
export const ZOO_LANES = LANE_ROSTER

/**
 * Friendly names for the models the gateway actually reports.
 *
 * Keyed by a fragment of the `x-kompass-served-by` string, because that string
 * carries routing detail she does not need ("openrouter/nvidia/
 * nemotron-3-super-120b-a12b:free"). Unknown models still get a real name —
 * see `describeModel` — so a roster change degrades to a plainer label rather
 * than to a lie.
 */
const MODEL_PROFILES: { match: RegExp; name: string; origin: string; size: string }[] = [
  { match: /gpt-oss/i, name: "GPT-OSS", origin: "OpenAI, USA", size: "mittel" },
  { match: /nemotron/i, name: "Nemotron", origin: "NVIDIA, USA", size: "gross" },
  { match: /minimax/i, name: "MiniMax", origin: "MiniMax, China", size: "gross" },
  { match: /laguna/i, name: "Laguna", origin: "Poolside, USA", size: "klein" },
  { match: /deepseek/i, name: "DeepSeek", origin: "DeepSeek, China", size: "sehr gross" },
  { match: /gemini/i, name: "Gemini", origin: "Google, USA", size: "gross" },
  { match: /qwen/i, name: "Qwen", origin: "Alibaba, China", size: "gross" },
  { match: /claude/i, name: "Claude", origin: "Anthropic, USA", size: "sehr gross" },
  { match: /llama/i, name: "Llama", origin: "Meta, USA", size: "gross" },
  { match: /mistral|devstral/i, name: "Mistral", origin: "Mistral, Frankreich", size: "mittel" },
]

export type ModelProfile = { name: string; origin: string; size: string }

/**
 * Turns whatever the gateway reported into something worth showing a child.
 *
 * Never invents. An unrecognised model is named from its own string rather
 * than from a guess, because the one thing this station must not do is tell
 * her a model was something it was not.
 */
export function describeModel(servedBy: string): ModelProfile {
  const found = MODEL_PROFILES.find((profile) => profile.match.test(servedBy))
  if (found) return { name: found.name, origin: found.origin, size: found.size }

  // "openrouter/nvidia/some-model:free" -> "some-model". Ugly but true, which
  // is the right trade in this station specifically.
  const bare = servedBy.split("/").pop()?.split(":")[0] ?? servedBy
  return { name: bare || "unbekannt", origin: "unbekannt", size: "unbekannt" }
}

/** Code-capable lanes for the Werkstatt, strongest last. */
export const WERKSTATT_LANES = [
  "kompass-agentic",
  "kompass-hard",
] as const satisfies readonly Lane[]

export type Route = {
  lane: Lane
  maxTokens: number
}

/**
 * The lane for a station type.
 *
 * The pedagogy still constrains this, only now in terms the gateway actually
 * honours:
 *
 *   - `jagd` takes `kompass-simple` — the weakest, most confident chain. A
 *     helpful upgrade to a stronger lane would silently delete week two.
 *   - `labor` takes one fixed lane for *both* halves, so the comparison
 *     measures her prompt rather than the model.
 *   - `talk` takes `kompass-agentic`: it is open-ended conversation with a
 *     ten-year-old, and instruction-following on the safety prompt is the
 *     product rather than a nice-to-have.
 */
export function route(station: StationType): Route {
  switch (station) {
    case "talk":
      return { lane: "kompass-agentic", maxTokens: 700 }
    case "jagd":
      return { lane: "kompass-simple", maxTokens: 500 }
    case "labor":
      return { lane: "kompass-fast", maxTokens: 700 }
    case "zoo":
      return { lane: "kompass-fast", maxTokens: 500 }
    case "werkstatt":
      return { lane: "kompass-agentic", maxTokens: 4000 }
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
  options: { system?: string; overrideLane?: Lane; maxTokens?: number } = {},
): Promise<Reply> {
  const base = route(station)
  const first = options.overrideLane ?? base.lane
  const maxTokens = options.maxTokens ?? base.maxTokens

  const attempts: { lane: Lane | undefined; reason: string }[] = [
    { lane: first, reason: "" },
    // A different lane, per the fallback rule — not the same one again, which
    // would only re-run the failure.
    { lane: alternate(station, first), reason: "erste Wahl hat nicht geantwortet" },
  ]

  let lastError = ""

  for (const [index, attempt] of attempts.entries()) {
    if (!attempt.lane) continue
    if (index > 0 && attempt.lane === attempts[index - 1]?.lane) continue

    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    try {
      const answer = await ask(messages, {
        lane: attempt.lane,
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
          model: attempt.lane,
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
function alternate(station: StationType, tried: Lane | undefined): Lane | undefined {
  if (station === "werkstatt") {
    return WERKSTATT_LANES.find((lane) => lane !== tried)
  }
  // `labor` must never silently change lane: a retry on a different model
  // would make the two halves incomparable, which is worse than no answer.
  if (station === "labor") return undefined
  return tried === "kompass-agentic" ? "kompass-fast" : "kompass-agentic"
}

/**
 * Three lanes for one Zoo round, without repeats.
 *
 * Seeded by the round number rather than randomly so a reload shows her the
 * same three — a blind ranking she can refresh her way out of is not a
 * ranking.
 *
 * Returns *lanes*, and each resolves to a genuinely different model. What she
 * is finally told each one was comes from the response header, never from
 * this function.
 */
export function zooTrio(seed: number): Lane[] {
  const roster: Lane[] = [...ZOO_LANES]
  const picked: Lane[] = []
  for (let i = 0; i < 3; i += 1) {
    const index = (seed * 7 + i * 3 + i * i) % roster.length
    const [lane] = roster.splice(index, 1)
    if (lane) picked.push(lane)
  }
  return picked
}
