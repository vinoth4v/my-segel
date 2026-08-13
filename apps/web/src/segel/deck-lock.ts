import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { env } from "@/env"

/**
 * A second lock in front of the Kapitäns-Deck.
 *
 * The app has exactly one account, and that is on purpose — a second user
 * means a real user store, which is a decision to raise rather than to
 * implement quietly. But a single account creates a real problem this app
 * cannot ignore: the person using the session is usually the child, and the
 * parent deck holds every transcript, the kill switch and the caps.
 *
 * So the deck is gated by re-entering the operator's own password. Same one
 * identity, no second user, no new table — but a ten-year-old sitting at an
 * open session cannot read her own transcripts back, raise her own time
 * limit, or turn off the pause her father set.
 *
 * The unlock is a short-lived HMAC over an expiry, signed with AUTH_SECRET.
 * Nothing is stored server-side: the cookie is the whole state, and it dies
 * on its own.
 */

const COOKIE = "segel_deck"
const WINDOW_MS = 30 * 60 * 1000

function sign(expires: number): string {
  return createHmac("sha256", env().AUTH_SECRET).update(String(expires)).digest("hex")
}

export function mintUnlock(): { value: string; maxAge: number } {
  const expires = Date.now() + WINDOW_MS
  return { value: `${expires}.${sign(expires)}`, maxAge: Math.floor(WINDOW_MS / 1000) }
}

export async function deckUnlocked(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return false

  const [stamp, mac] = raw.split(".")
  if (!stamp || !mac) return false

  const expires = Number(stamp)
  if (!Number.isFinite(expires) || expires < Date.now()) return false

  const expected = sign(expires)
  // Both are hex of the same length, so this comparison is safe to make
  // constant-time — and a forged cookie is exactly the case where a
  // byte-by-byte early exit would leak.
  if (mac.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))
}

export const DECK_COOKIE = COOKIE
