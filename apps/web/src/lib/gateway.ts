import type { StationType } from "../content/schema.ts"
import { ask, type Message } from "../kompass.ts"
import { fallbackFor, type Route } from "./router.ts"

/**
 * One call to a model, with the failure handling every station needs.
 *
 * The rule from the spec: a call that errors or runs past its timeout retries
 * once on a different free model, then escalates. Escalations are reported
 * back so the deck can show the free-to-paid ratio — the parent's promise is
 * "no surprise costs", and that is only true if the paid calls are countable.
 *
 * `jagd` never escalates. Its route returns no fallback at all, because a
 * strong model quietly rescuing the weak one would delete the only lesson
 * that station exists to teach.
 */

export type Attempt = {
  text: string
  /** The lane or pin that produced this — the gateway's own header, not a guess. */
  servedBy: string
  lane: string
  /** 0 for the first try. Anything above 0 means something failed first. */
  attempt: number
  escalated: boolean
  inputTokens: number
  outputTokens: number
}

export type GatewayFailure = {
  ok: false
  /** Every attempt's error, joined — the deck shows this, she never does. */
  detail: string
}

export type GatewayResult = ({ ok: true } & Attempt) | GatewayFailure

/**
 * `ask` with a deadline.
 *
 * The gateway can be slow rather than broken, and a station that hangs for a
 * minute is indistinguishable from one that crashed to the person waiting.
 * AbortSignal.timeout rather than a race, so the request is actually cancelled
 * instead of merely ignored.
 */
async function askWithTimeout(
  messages: readonly Message[],
  route: Route,
  system: string,
): Promise<Attempt> {
  const answer = await ask(messages, {
    model: route.model,
    system,
    maxTokens: route.maxTokens,
    signal: AbortSignal.timeout(route.timeoutMs),
  })

  return {
    text: answer.text,
    servedBy: answer.servedBy || route.model,
    lane: answer.lane || route.model,
    attempt: 0,
    escalated: false,
    inputTokens: answer.inputTokens,
    outputTokens: answer.outputTokens,
  }
}

/**
 * Calls a station's model, falling back and finally escalating.
 *
 * `accept` lets the caller reject a *successful* response that is unusable —
 * Werkstatt uses it for an answer that came back fine but contains no HTML,
 * which is a failure the HTTP status cannot see. Without it, a 200 carrying
 * nothing renderable would put a blank frame in front of her, which the spec
 * rightly treats as a failed session.
 */
export async function callStation(options: {
  station: StationType
  route: Route
  system: string
  messages: readonly Message[]
  accept?: (text: string) => boolean
}): Promise<GatewayResult> {
  const { station, route, system, messages, accept } = options
  const problems: string[] = []

  for (let attempt = 0; ; attempt += 1) {
    const current = attempt === 0 ? route : fallbackFor(station, attempt - 1)
    if (!current) break

    try {
      const result = await askWithTimeout(messages, current, system)

      if (accept && !accept(result.text)) {
        problems.push(`${current.model}: answered but produced nothing usable`)
        continue
      }

      return {
        ok: true,
        ...result,
        attempt,
        // Anything past the first fallback is the paid lane. That is the
        // number the parent deck reports.
        escalated: attempt >= 2,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      problems.push(`${current.model}: ${message}`)
    }
  }

  return { ok: false, detail: problems.join(" | ") }
}

/**
 * Three models on one prompt, in parallel, where a slow one must not hold up
 * the others.
 *
 * `allSettled` rather than `all` is the whole point: the acceptance test for
 * the zoo is that a timeout on one column still renders the other two. Each
 * column carries its own short deadline, so the station finishes in about the
 * time of the slowest survivor rather than the sum.
 */
export type ZooColumn = {
  label: string
  text: string | null
  servedBy: string
  failed: boolean
}

export async function fanOut(options: {
  routes: readonly Route[]
  system: string
  messages: readonly Message[]
}): Promise<ZooColumn[]> {
  const { routes, system, messages } = options

  const settled = await Promise.allSettled(
    routes.map((route) => askWithTimeout(messages, route, system)),
  )

  return settled.map((outcome, index) => {
    const route = routes[index]
    const label = route?.label ?? String.fromCharCode(65 + index)

    if (outcome.status === "fulfilled" && outcome.value.text.trim()) {
      return {
        label,
        text: outcome.value.text,
        servedBy: outcome.value.servedBy,
        failed: false,
      }
    }

    return { label, text: null, servedBy: route?.model ?? "", failed: true }
  })
}
