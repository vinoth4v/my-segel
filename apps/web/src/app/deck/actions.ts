"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { verifyPassword } from "@/auth/password"
import { recordEvent } from "@/db/events"
import { env } from "@/env"
import { DECK_COOKIE, deckUnlocked, mintUnlock } from "@/segel/deck-lock"
import { type SettingKey, setSetting } from "@/segel/store"

/** Unlock the deck by re-entering the operator's password. */
export async function unlockDeck(formData: FormData): Promise<void> {
  const session = await auth()
  if (!session?.user) return

  const password = String(formData.get("password") ?? "")
  if (!verifyPassword(password, env().WERFT_PASSWORD_HASH)) {
    await recordEvent("sign_in_failed", session.user.email ?? null, "deck unlock")
    return
  }

  const unlock = mintUnlock()
  const store = await cookies()
  store.set(DECK_COOKIE, unlock.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: unlock.maxAge,
  })

  revalidatePath("/deck")
}

export async function lockDeck(): Promise<void> {
  const store = await cookies()
  store.delete(DECK_COOKIE)
  revalidatePath("/deck")
}

/**
 * Change a cap or flip the kill switch.
 *
 * Guarded by the deck lock rather than only by the session, because the
 * session is usually the child's — an unguarded action here would let her
 * raise her own time limit, which is the one thing the caps exist to prevent.
 */
export async function updateSetting(formData: FormData): Promise<void> {
  if (!(await deckUnlocked())) return

  const key = String(formData.get("key") ?? "") as SettingKey
  const value = Number(formData.get("value"))
  const allowed: SettingKey[] = [
    "sessionCapMinutes",
    "dailyCapMinutes",
    "idleResetMinutes",
    "paused",
  ]
  if (!allowed.includes(key) || !Number.isFinite(value)) return

  await setSetting(key, Math.max(0, Math.round(value)))
  revalidatePath("/deck")
}
