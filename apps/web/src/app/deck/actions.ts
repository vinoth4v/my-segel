"use server"

import { revalidatePath } from "next/cache"
import { writeSetting } from "@/db/segel"
import { deckUnlocked, lockDeck, unlockDeck } from "@/lib/deck-gate"
import { SETTING_KEYS } from "@/lib/limits"

export async function unlockAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "")
  await unlockDeck(password)
  revalidatePath("/deck")
}

export async function lockAction(): Promise<void> {
  await lockDeck()
  revalidatePath("/deck")
}

/**
 * The three things the parent can change without a deploy.
 *
 * Guarded here as well as by the page, because a server action is a public
 * endpoint — the page not rendering the form is not the same as the action
 * refusing to run.
 */
export async function saveSettingsAction(formData: FormData): Promise<void> {
  if (!(await deckUnlocked())) return

  const session = String(formData.get("sessionCap") ?? "")
  const day = String(formData.get("dayCap") ?? "")
  const kill = formData.get("killSwitch") === "on"

  if (Number(session) > 0) await writeSetting(SETTING_KEYS.sessionCap, session)
  if (Number(day) > 0) await writeSetting(SETTING_KEYS.dayCap, day)
  await writeSetting(SETTING_KEYS.killSwitch, kill ? "on" : "off")

  revalidatePath("/deck")
}
