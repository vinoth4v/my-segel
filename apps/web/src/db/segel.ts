import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm"
import { db } from "./client.ts"
import {
  artifact,
  artifactVersion,
  escalation,
  logbuchEntry,
  message,
  SEGLER,
  sessionWindow,
  setting,
  stationRun,
  voyageProgress,
} from "./schema.ts"

/**
 * Everything Segel reads and writes.
 *
 * Every query filters on `learner` even though there is one learner, for the
 * reason given in schema.ts: the ownership pattern is what makes a second
 * child a schema change rather than an audit of every query. Consistency here
 * is cheap; retrofitting it is not.
 */

export type Role = "segler" | "schiff"

/** A station reopened within this long is the same visit, not a new one. */
const RUN_RESUME_HOURS = 3

/**
 * The run she is currently in, opening one if there is none.
 *
 * Reuses an unfinished run of the same station rather than always inserting,
 * because otherwise a page refresh — which a ten-year-old does constantly —
 * would split one conversation across two transcripts and lose the context the
 * model is given.
 */
export async function startRun(voyageSlug: string, stationId: string): Promise<string> {
  const resumeCutoff = new Date(Date.now() - RUN_RESUME_HOURS * 60 * 60_000)

  const [existing] = await db()
    .select({ id: stationRun.id })
    .from(stationRun)
    .where(
      and(
        eq(stationRun.learner, SEGLER),
        eq(stationRun.voyageSlug, voyageSlug),
        eq(stationRun.stationId, stationId),
        isNull(stationRun.completedAt),
        gte(stationRun.startedAt, resumeCutoff),
      ),
    )
    .orderBy(desc(stationRun.startedAt))
    .limit(1)

  if (existing) return existing.id

  const [row] = await db()
    .insert(stationRun)
    .values({ learner: SEGLER, voyageSlug, stationId })
    .returning({ id: stationRun.id })

  if (!row) throw new Error("could not open a station run")

  // Starting any station starts the voyage. onConflictDoNothing so re-entering
  // a voyage does not reset the date she first sailed it.
  await db()
    .insert(voyageProgress)
    .values({ learner: SEGLER, voyageSlug })
    .onConflictDoNothing({ target: [voyageProgress.learner, voyageProgress.voyageSlug] })

  return row.id
}

export async function completeRun(runId: string): Promise<void> {
  await db()
    .update(stationRun)
    .set({ completedAt: new Date() })
    .where(and(eq(stationRun.id, runId), isNull(stationRun.completedAt)))
}

export async function addMessage(input: {
  runId: string
  role: Role
  content: string
  model?: string
  servedBy?: string
  blocked?: boolean
  blockReason?: string
}): Promise<void> {
  await db()
    .insert(message)
    .values({
      runId: input.runId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      servedBy: input.servedBy ?? null,
      blocked: input.blocked ?? false,
      blockReason: input.blockReason ?? null,
    })
}

/** The turns of one station, oldest first — what the model is given as context. */
export async function messagesFor(runId: string) {
  return db()
    .select()
    .from(message)
    .where(eq(message.runId, runId))
    .orderBy(asc(message.at))
}

export async function runById(runId: string) {
  const [row] = await db()
    .select()
    .from(stationRun)
    .where(and(eq(stationRun.id, runId), eq(stationRun.learner, SEGLER)))
    .limit(1)

  return row
}

/**
 * Which stations of a voyage she has finished.
 *
 * A station counts as finished when a run of it was completed — not when it
 * was merely opened, which is what makes "continue where you left off" land on
 * the right station after she wandered off mid-Jagd.
 */
export async function completedStationIds(voyageSlug: string): Promise<string[]> {
  const rows = await db()
    .selectDistinct({ stationId: stationRun.stationId })
    .from(stationRun)
    .where(
      and(
        eq(stationRun.learner, SEGLER),
        eq(stationRun.voyageSlug, voyageSlug),
        sql`${stationRun.completedAt} is not null`,
      ),
    )

  return rows.map((row) => row.stationId)
}

export async function allProgress() {
  return db().select().from(voyageProgress).where(eq(voyageProgress.learner, SEGLER))
}

export async function completeVoyage(voyageSlug: string, debrief: string | null): Promise<void> {
  await db()
    .update(voyageProgress)
    .set({ completedAt: new Date(), debrief })
    .where(
      and(eq(voyageProgress.learner, SEGLER), eq(voyageProgress.voyageSlug, voyageSlug)),
    )
}

/* ---------------------------------------------------------------- Logbuch -- */

export type LogbuchKind = "catch" | "ranking" | "build" | "quiz" | "echt"

export async function fileLogbuchEntry(input: {
  kind: LogbuchKind
  voyageSlug: string
  stationId: string
  title: string
  detail?: string
  quote?: string
  score?: number
  runId?: string
}): Promise<void> {
  await db()
    .insert(logbuchEntry)
    .values({
      learner: SEGLER,
      kind: input.kind,
      voyageSlug: input.voyageSlug,
      stationId: input.stationId,
      title: input.title,
      detail: input.detail ?? null,
      quote: input.quote ?? null,
      score: input.score ?? 0,
      runId: input.runId ?? null,
    })
}

export async function logbuch(limit = 200) {
  return db()
    .select()
    .from(logbuchEntry)
    .where(eq(logbuchEntry.learner, SEGLER))
    .orderBy(desc(logbuchEntry.at))
    .limit(limit)
}

/**
 * Catches per day, which is the success metric the whole app is measured on.
 *
 * Grouped by day rather than by session because a session boundary is a fuzzy
 * thing and a day is not — and "is it trending up over six weeks" reads the
 * same either way.
 */
export async function catchesByDay() {
  return db()
    .select({
      day: sql<string>`to_char(${logbuchEntry.at} at time zone 'UTC', 'YYYY-MM-DD')`.as("day"),
      catches: sql<number>`count(*)::int`.as("catches"),
    })
    .from(logbuchEntry)
    .where(and(eq(logbuchEntry.learner, SEGLER), eq(logbuchEntry.kind, "catch")))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
}

/* -------------------------------------------------------------- Werkstatt -- */

export async function createArtifact(title: string): Promise<string> {
  const [row] = await db()
    .insert(artifact)
    .values({ learner: SEGLER, title })
    .returning({ id: artifact.id })

  if (!row) throw new Error("could not create the artifact")
  return row.id
}

export async function addArtifactVersion(input: {
  artifactId: string
  prompt: string
  html: string
  escalated: boolean
  servedBy?: string
}): Promise<number> {
  const existing = await db()
    .select({ version: artifactVersion.version })
    .from(artifactVersion)
    .where(eq(artifactVersion.artifactId, input.artifactId))
    .orderBy(desc(artifactVersion.version))
    .limit(1)

  const version = (existing[0]?.version ?? 0) + 1

  await db().insert(artifactVersion).values({
    artifactId: input.artifactId,
    version,
    prompt: input.prompt,
    html: input.html,
    escalated: input.escalated,
    servedBy: input.servedBy ?? null,
  })

  await db().update(artifact).set({ updatedAt: new Date() }).where(eq(artifact.id, input.artifactId))

  return version
}

export async function galerie() {
  return db()
    .select()
    .from(artifact)
    .where(eq(artifact.learner, SEGLER))
    .orderBy(desc(artifact.updatedAt))
}

export async function artifactById(id: string) {
  const [row] = await db()
    .select()
    .from(artifact)
    .where(and(eq(artifact.id, id), eq(artifact.learner, SEGLER)))
    .limit(1)

  return row
}

/** Oldest first: scrubbing forward through her own versions is the point. */
export async function versionsOf(artifactId: string) {
  return db()
    .select()
    .from(artifactVersion)
    .where(eq(artifactVersion.artifactId, artifactId))
    .orderBy(asc(artifactVersion.version))
}

export async function recordEscalation(input: {
  station: string
  fromModel: string
  toModel: string
  reason: string
}): Promise<void> {
  // Never allowed to break a station: the escalation already happened, and
  // failing to write the note about it is not a reason to lose her artifact.
  try {
    await db().insert(escalation).values(input)
  } catch (error) {
    console.error("escalation write failed", error)
  }
}

export async function escalations(limit = 50) {
  return db().select().from(escalation).orderBy(desc(escalation.at)).limit(limit)
}

/* ------------------------------------------------------------ Deck & caps -- */

export async function recentRuns(limit = 100) {
  return db()
    .select()
    .from(stationRun)
    .where(eq(stationRun.learner, SEGLER))
    .orderBy(desc(stationRun.startedAt))
    .limit(limit)
}

export async function readSettings(): Promise<Record<string, string>> {
  const rows = await db().select().from(setting)
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await db()
    .insert(setting)
    .values({ key, value })
    .onConflictDoUpdate({ target: setting.key, set: { value, updatedAt: new Date() } })
}

/**
 * Opens or extends the current session window, and reports the minutes used.
 *
 * A window is "current" while it has been touched within the idle gap; a
 * longer pause than that counts as her having stopped, and the next request
 * opens a fresh window. Without the gap, one afternoon of walking away and
 * coming back would read as a five-hour session and lock her out.
 */
const IDLE_GAP_MINUTES = 15

export async function touchSession(): Promise<{ sessionMinutes: number; dayMinutes: number }> {
  const now = new Date()
  const idleCutoff = new Date(now.getTime() - IDLE_GAP_MINUTES * 60_000)

  const [open] = await db()
    .select()
    .from(sessionWindow)
    .where(and(eq(sessionWindow.learner, SEGLER), gte(sessionWindow.lastSeenAt, idleCutoff)))
    .orderBy(desc(sessionWindow.lastSeenAt))
    .limit(1)

  if (open) {
    await db()
      .update(sessionWindow)
      .set({ lastSeenAt: now })
      .where(eq(sessionWindow.id, open.id))
  } else {
    await db().insert(sessionWindow).values({ learner: SEGLER, startedAt: now, lastSeenAt: now })
  }

  return usage()
}

/** Minutes in the current window and in the last 24 hours, without touching anything. */
export async function usage(): Promise<{ sessionMinutes: number; dayMinutes: number }> {
  const now = new Date()
  const idleCutoff = new Date(now.getTime() - IDLE_GAP_MINUTES * 60_000)
  const dayCutoff = new Date(now.getTime() - 24 * 60 * 60_000)

  const windows = await db()
    .select()
    .from(sessionWindow)
    .where(and(eq(sessionWindow.learner, SEGLER), gte(sessionWindow.lastSeenAt, dayCutoff)))
    .orderBy(desc(sessionWindow.lastSeenAt))

  const minutes = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / 60_000)

  const dayMinutes = windows.reduce(
    (total, row) => total + minutes(row.startedAt, row.lastSeenAt),
    0,
  )

  const current = windows.find((row) => row.lastSeenAt >= idleCutoff)
  const sessionMinutes = current ? minutes(current.startedAt, current.lastSeenAt) : 0

  return { sessionMinutes, dayMinutes }
}
