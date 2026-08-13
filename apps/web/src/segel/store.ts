import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import type { UsageDayRow } from "@/db/schema"
import {
  appSetting,
  artifact,
  artifactVersion,
  logbuchEntry,
  stationProgress,
  transcript,
  usageDay,
} from "@/db/schema"
import type { CallRecord, StationType } from "@/segel/router"

/**
 * Everything that touches the database, in one place.
 *
 * Route handlers call these; nothing else opens a query. That is worth the
 * indirection here because two of the rules the app makes to the parent —
 * every exchange is recorded, and the caps are enforced on the server — are
 * only true if there is no second path that skips them.
 */

/* ---------------------------------------------------------------- settings */

/**
 * Defaults in code, overrides in the table.
 *
 * An empty table is a working app with sane limits, so a fresh database or a
 * preview branch never opens the gates by accident.
 */
export const SETTING_DEFAULTS = {
  /** Minutes in one sitting before the app stops. The anti-metric is time. */
  sessionCapMinutes: 40,
  /** Minutes in one day, across sittings. */
  dailyCapMinutes: 60,
  /** Minutes of quiet after which the next call counts as a new sitting. */
  idleResetMinutes: 15,
  /** The parent's kill switch. "1" stops every model call. */
  paused: 0,
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS
export type Settings = Record<SettingKey, number>

export async function settings(): Promise<Settings> {
  const resolved: Settings = { ...SETTING_DEFAULTS }
  try {
    const rows = await db().select().from(appSetting)
    for (const row of rows) {
      if (row.key in resolved) {
        const value = Number(row.value)
        if (Number.isFinite(value)) resolved[row.key as SettingKey] = value
      }
    }
  } catch (error) {
    // A settings read that fails must not open the gates: the defaults are
    // the safe answer, and the parent deck will show the database is down.
    console.error("settings read failed, using defaults", error)
  }
  return resolved
}

export async function setSetting(key: SettingKey, value: number): Promise<void> {
  await db()
    .insert(appSetting)
    .values({ key, value: String(value) })
    .onConflictDoUpdate({
      target: appSetting.key,
      set: { value: String(value), updatedAt: new Date() },
    })
}

/* ------------------------------------------------------------------- caps */

export type CapVerdict =
  | { allowed: true; sessionMinutes: number; dailyMinutes: number }
  | { allowed: false; reason: "paused" | "session" | "daily" | "offline"; message: string }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Whether a model call may happen right now, and the clock ticked if so.
 *
 * Called before every model call, which is what makes it enforcement rather
 * than decoration: there is no client timer to outlast and no page to
 * reload past. The minute accounting is deliberately coarse — it charges the
 * gap between consecutive calls, capped at the idle window, so thinking time
 * counts and a walk away from the desk does not.
 *
 * It fails *closed* when the database is unreachable, and that is the
 * deliberate choice rather than an oversight. Two promises depend on it: the
 * caps are enforced server-side, and every exchange is recorded for the
 * parent. A model call that proceeds without a reachable database quietly
 * breaks both — she would talk to a model with no cap and no transcript, and
 * nobody would find out. Refusing is honest and visibly broken; proceeding is
 * invisibly broken.
 */
export async function checkCaps(): Promise<CapVerdict> {
  const config = await settings()

  if (config.paused >= 1) {
    return {
      allowed: false,
      reason: "paused",
      message: "Papa hat Segel gerade angehalten. Frag ihn, wenn du weitermachen willst.",
    }
  }

  const day = today()
  const now = new Date()

  let existing: UsageDayRow | undefined
  try {
    ;[existing] = await db().select().from(usageDay).where(eq(usageDay.day, day))
  } catch (error) {
    console.error("usage read failed — refusing the call rather than losing the transcript", error)
    return { allowed: false, reason: "offline", message: OFFLINE_MESSAGE }
  }

  const lastSeen = existing?.lastSeenAt ?? null
  const gapMinutes = lastSeen
    ? (now.getTime() - lastSeen.getTime()) / 60_000
    : Number.POSITIVE_INFINITY
  const newSitting = gapMinutes >= config.idleResetMinutes

  // Charge the gap, but never more than the idle window — otherwise a lunch
  // break would eat the whole daily allowance.
  const charged = newSitting ? 0 : Math.max(0, Math.round(gapMinutes))

  const sessionMinutes = newSitting ? 0 : (existing?.sessionMinutes ?? 0) + charged
  const dailyMinutes = (existing?.activeMinutes ?? 0) + charged

  if (dailyMinutes >= config.dailyCapMinutes) {
    return {
      allowed: false,
      reason: "daily",
      message: "Für heute reicht es. Morgen geht es weiter — das Logbuch bleibt da.",
    }
  }
  if (sessionMinutes >= config.sessionCapMinutes) {
    return {
      allowed: false,
      reason: "session",
      message: "Das war eine lange Fahrt. Mach eine Pause, dann kannst du weitersegeln.",
    }
  }

  try {
    await db()
      .insert(usageDay)
      .values({
        day,
        activeMinutes: dailyMinutes,
        sessionMinutes,
        sessionStartedAt: newSitting ? now : (existing?.sessionStartedAt ?? now),
        lastSeenAt: now,
        calls: 1,
      })
      .onConflictDoUpdate({
        target: usageDay.day,
        set: {
          activeMinutes: dailyMinutes,
          sessionMinutes,
          sessionStartedAt: newSitting ? now : (existing?.sessionStartedAt ?? now),
          lastSeenAt: now,
          calls: sql`${usageDay.calls} + 1`,
        },
      })
  } catch (error) {
    // The clock could not be advanced. Allowing the call anyway would make
    // the cap unenforceable for as long as the write keeps failing.
    console.error("usage write failed — refusing the call so the cap stays real", error)
    return { allowed: false, reason: "offline", message: OFFLINE_MESSAGE }
  }

  return { allowed: true, sessionMinutes, dailyMinutes }
}

const OFFLINE_MESSAGE =
  "Segel kann gerade nichts mitschreiben, deshalb frage ich jetzt kein Modell. Sag Papa Bescheid."

export async function usageToday() {
  const [row] = await db().select().from(usageDay).where(eq(usageDay.day, today()))
  return row
}

export async function usageRecent(days = 14) {
  return db().select().from(usageDay).orderBy(desc(usageDay.day)).limit(days)
}

/* ------------------------------------------------------------- transcript */

export type TranscriptWrite = {
  voyageId: string
  stationId: string
  stationType: StationType
  role: "kind" | "modell" | "system"
  content: string
  call?: CallRecord
  flagged?: boolean
  flagReason?: string
}

/**
 * Record one turn.
 *
 * Unlike the audit log this does *not* swallow failures silently in a way
 * the parent cannot see — it still never blocks her session, because a
 * database hiccup must not end a lesson, but it prints loudly. Losing a turn
 * is a broken promise, not a missing metric.
 */
export async function recordTurn(entry: TranscriptWrite): Promise<void> {
  try {
    await db()
      .insert(transcript)
      .values({
        voyageId: entry.voyageId,
        stationId: entry.stationId,
        stationType: entry.stationType,
        role: entry.role,
        content: entry.content,
        model: entry.call?.model ?? null,
        lane: entry.call?.lane ?? null,
        servedBy: entry.call?.servedBy ?? null,
        escalated: entry.call?.escalated ?? false,
        escalationReason: entry.call?.escalationReason || null,
        flagged: entry.flagged ?? false,
        flagReason: entry.flagReason ?? null,
        inputTokens: entry.call?.inputTokens ?? 0,
        outputTokens: entry.call?.outputTokens ?? 0,
      })
  } catch (error) {
    console.error("transcript write failed — a turn was not recorded", error)
  }
}

export async function transcriptFor(voyageId?: string, limit = 200) {
  const query = db().select().from(transcript).orderBy(desc(transcript.at)).limit(limit)
  return voyageId ? query.where(eq(transcript.voyageId, voyageId)) : query
}

export async function escalations(limit = 50) {
  return db()
    .select()
    .from(transcript)
    .where(eq(transcript.escalated, true))
    .orderBy(desc(transcript.at))
    .limit(limit)
}

export async function flagged(limit = 50) {
  return db()
    .select()
    .from(transcript)
    .where(eq(transcript.flagged, true))
    .orderBy(desc(transcript.at))
    .limit(limit)
}

/* ---------------------------------------------------------------- logbuch */

export type LogbuchWrite = {
  kind: "catch" | "ranking" | "build" | "note"
  voyageId: string
  stationId: string
  title: string
  detail?: string
  why?: string
  payload?: unknown
}

export async function fileEntry(entry: LogbuchWrite) {
  const [row] = await db()
    .insert(logbuchEntry)
    .values({
      kind: entry.kind,
      voyageId: entry.voyageId,
      stationId: entry.stationId,
      title: entry.title,
      detail: entry.detail ?? null,
      why: entry.why ?? null,
      payload: entry.payload ?? null,
    })
    .returning()
  return row
}

export async function logbuch(limit = 100) {
  return db().select().from(logbuchEntry).orderBy(desc(logbuchEntry.at)).limit(limit)
}

export async function catchCounts() {
  const rows = await db()
    .select({
      voyageId: logbuchEntry.voyageId,
      day: sql<string>`to_char(${logbuchEntry.at}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(logbuchEntry)
    .where(eq(logbuchEntry.kind, "catch"))
    .groupBy(logbuchEntry.voyageId, sql`to_char(${logbuchEntry.at}, 'YYYY-MM-DD')`)
  return rows
}

/* --------------------------------------------------------------- progress */

export async function progress() {
  return db().select().from(stationProgress)
}

export async function startStation(voyageId: string, stationId: string) {
  await db()
    .insert(stationProgress)
    .values({ voyageId, stationId })
    .onConflictDoNothing({ target: [stationProgress.voyageId, stationProgress.stationId] })
}

/**
 * Mark a station done, or bump its tally.
 *
 * `completedAt` is only ever set, never cleared: finishing something is not
 * something the app should be able to take back from her.
 */
export async function markStation(
  voyageId: string,
  stationId: string,
  { score, complete }: { score?: number; complete?: boolean },
) {
  await db()
    .insert(stationProgress)
    .values({
      voyageId,
      stationId,
      score: score ?? 0,
      completedAt: complete ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [stationProgress.voyageId, stationProgress.stationId],
      set: {
        ...(score === undefined ? {} : { score }),
        ...(complete ? { completedAt: new Date() } : {}),
      },
    })
}

/* -------------------------------------------------------------- artifacts */

export async function createArtifact(input: {
  voyageId: string
  stationId: string
  title: string
  prompt: string
  html: string
  model?: string
  escalated?: boolean
}) {
  const [row] = await db()
    .insert(artifact)
    .values({
      voyageId: input.voyageId,
      stationId: input.stationId,
      title: input.title,
    })
    .returning()

  if (!row) throw new Error("artifact insert returned nothing")

  await db()
    .insert(artifactVersion)
    .values({
      artifactId: row.id,
      version: 1,
      prompt: input.prompt,
      html: input.html,
      model: input.model ?? null,
      escalated: input.escalated ?? false,
    })

  return row
}

export async function addVersion(
  artifactId: string,
  input: { prompt: string; html: string; model?: string; escalated?: boolean },
) {
  const versions = await db()
    .select()
    .from(artifactVersion)
    .where(eq(artifactVersion.artifactId, artifactId))
  const next = versions.reduce((highest, row) => Math.max(highest, row.version), 0) + 1

  await db()
    .insert(artifactVersion)
    .values({
      artifactId,
      version: next,
      prompt: input.prompt,
      html: input.html,
      model: input.model ?? null,
      escalated: input.escalated ?? false,
    })

  await db()
    .update(artifact)
    .set({ currentVersion: next, updatedAt: new Date() })
    .where(eq(artifact.id, artifactId))

  return next
}

export async function artifacts() {
  return db().select().from(artifact).orderBy(desc(artifact.updatedAt))
}

export async function artifactWithVersions(id: string) {
  const [row] = await db().select().from(artifact).where(eq(artifact.id, id))
  if (!row) return undefined
  const versions = await db()
    .select()
    .from(artifactVersion)
    .where(eq(artifactVersion.artifactId, id))
    .orderBy(artifactVersion.version)
  return { artifact: row, versions }
}

export async function versionHtml(artifactId: string, version: number) {
  const [row] = await db()
    .select()
    .from(artifactVersion)
    .where(and(eq(artifactVersion.artifactId, artifactId), eq(artifactVersion.version, version)))
  return row
}

export async function setShown(id: string, shown: boolean) {
  await db().update(artifact).set({ shown }).where(eq(artifact.id, id))
}

export async function setCurrentVersion(id: string, version: number) {
  await db()
    .update(artifact)
    .set({ currentVersion: version, updatedAt: new Date() })
    .where(eq(artifact.id, id))
}
