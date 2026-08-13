import { auth } from "@/auth"
import { checkCaps } from "@/segel/store"

/**
 * The three things every model-calling route must do before it does anything
 * else: confirm there is a session, confirm the caps allow it, and stop
 * early in a way the child can read.
 *
 * It lives here rather than in each handler because "the caps are enforced
 * server-side" is a promise to the parent, and a promise that depends on
 * seven handlers each remembering is not a promise. The proxy already gates
 * every route; the session check here is deliberate belt-and-braces, since a
 * mistake in the matcher would otherwise expose a model endpoint.
 */

export type Blocked = { blocked: true; response: Response }
export type Allowed = { blocked: false }

export async function guard(): Promise<Blocked | Allowed> {
  const session = await auth()
  if (!session?.user) {
    return {
      blocked: true,
      response: Response.json({ error: "Nicht angemeldet." }, { status: 401 }),
    }
  }

  const caps = await checkCaps()
  if (!caps.allowed) {
    // 200 with a spoken message, not an error status: this is a rule of the
    // app working correctly, and the station should render it as speech
    // rather than as something being broken.
    return {
      blocked: true,
      response: Response.json({ stopped: caps.reason, message: caps.message }),
    }
  }

  return { blocked: false }
}

/** Reads a JSON body without letting a malformed one throw a 500. */
export async function body<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T
  } catch {
    return undefined
  }
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}
