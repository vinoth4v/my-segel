import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { verifyPassword } from "../auth/password.ts"
import { env } from "../env.ts"

/**
 * The second lock, in front of the Kapitäns-Deck.
 *
 * There is exactly one credential in this app and there is deliberately no
 * second user — the template's rule, and the right one: a real second identity
 * needs a real user store, which is a decision to raise rather than to
 * implement quietly in a children's app.
 *
 * So the two roles are not two accounts. The session is the household's, the
 * Segler view is what it opens on, and the deck — transcripts, caps, the kill
 * switch — is behind a re-entry of the same operator password. That is the
 * honest version of "she cannot read her own transcripts back or turn the cap
 * off": she does not have the password, and the app never stores it anywhere
 * she could get at.
 *
 * The unlock is a short-lived signed cookie rather than a session flag, so
 * walking away from the laptop re-locks the deck without anyone signing out.
 */

const COOKIE = "segel_deck"
const TTL_MINUTES = 30

function sign(expiresAt: number): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`deck:${expiresAt}`).digest("hex")
}

/** Constant-time, and length-checked first — timingSafeEqual throws on a mismatch. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function deckUnlocked(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return false

  const [expiresRaw, signature] = raw.split(".")
  const expiresAt = Number(expiresRaw)
  if (!expiresRaw || !signature || !Number.isFinite(expiresAt)) return false
  if (expiresAt < Date.now()) return false

  return matches(signature, sign(expiresAt))
}

/**
 * Checks the operator password and opens the deck.
 *
 * Returns a boolean rather than throwing, and the caller shows one message for
 * every failure — the same reason the login page never says which half was
 * wrong.
 */
export async function unlockDeck(password: string): Promise<boolean> {
  if (!verifyPassword(password, env().WERFT_PASSWORD_HASH)) return false

  const expiresAt = Date.now() + TTL_MINUTES * 60_000
  const jar = await cookies()
  jar.set(COOKIE, `${expiresAt}.${sign(expiresAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MINUTES * 60,
  })

  return true
}

export async function lockDeck(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}
