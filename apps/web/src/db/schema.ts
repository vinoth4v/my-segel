import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Append-only record of things worth knowing after the fact: sign-ins,
 * failed sign-ins, and whatever the app built on this template adds.
 *
 * A single-operator app has no admin console, so this table is the only
 * place a past event is recoverable from.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind").notNull(),
    actor: text("actor"),
    detail: text("detail"),
  },
  (table) => [index("audit_log_at_idx").on(table.at)],
)

export type AuditLogRow = typeof auditLog.$inferSelect
export type NewAuditLogRow = typeof auditLog.$inferInsert

/**
 * Everything said to a model and everything it said back.
 *
 * Append-only, and the child has no way to delete a row — the parent's
 * promise is full transcript visibility, and a transcript she can prune is
 * not a transcript. `flagged` marks a reply the output filter replaced;
 * `escalation` records that a free model failed and something else answered,
 * which is what keeps the free-to-paid ratio visible.
 *
 * Introduced by migration 0001_segel.
 */
export const transcript = pgTable(
  "transcript",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    voyageId: text("voyage_id").notNull(),
    stationId: text("station_id").notNull(),
    stationType: text("station_type").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** Which model was asked for. Null on her own messages. */
    model: text("model"),
    /** Which lane and concrete model the gateway used, from its headers. */
    lane: text("lane"),
    servedBy: text("served_by"),
    escalated: boolean("escalated").notNull().default(false),
    escalationReason: text("escalation_reason"),
    /** Set when the output filter replaced this reply. */
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
  },
  (table) => [
    index("transcript_at_idx").on(table.at),
    index("transcript_station_idx").on(table.voyageId, table.stationId),
  ],
)

export type TranscriptRow = typeof transcript.$inferSelect

/**
 * The Logbuch: her caught errors, her rankings, her builds.
 *
 * One table rather than three, because it is one object to her — a ledger
 * she leafs through — and because the home page needs them interleaved in
 * time order. `payload` carries whatever the kind needs (the ranking she
 * gave, the models behind A/B/C) without a migration per station type.
 *
 * Introduced by migration 0001_segel.
 */
export const logbuchEntry = pgTable(
  "logbuch_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** catch | ranking | build | note */
    kind: text("kind").notNull(),
    voyageId: text("voyage_id").notNull(),
    stationId: text("station_id").notNull(),
    title: text("title").notNull(),
    /** What the model said, for a catch. */
    detail: text("detail"),
    /** Her own words: why it was wrong, why she ranked it first. */
    why: text("why"),
    payload: jsonb("payload"),
  },
  (table) => [index("logbuch_at_idx").on(table.at), index("logbuch_kind_idx").on(table.kind)],
)

export type LogbuchRow = typeof logbuchEntry.$inferSelect

/**
 * How far she has got. One row per station she has opened.
 *
 * Unique on (voyage, station) so completing a station twice updates rather
 * than accumulating — progress is a state, not a history. The history is the
 * transcript.
 *
 * Introduced by migration 0001_segel.
 */
export const stationProgress = pgTable(
  "station_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voyageId: text("voyage_id").notNull(),
    stationId: text("station_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Station-specific tally: catches filed, quiz score, builds saved. */
    score: integer("score").notNull().default(0),
  },
  (table) => [unique("station_progress_unique").on(table.voyageId, table.stationId)],
)

export type StationProgressRow = typeof stationProgress.$inferSelect

/**
 * What she built in the Werkstatt, and every version of it.
 *
 * Two tables rather than one: the gallery lists artifacts, and scrubbing
 * back through versions is the point of the station — each version keeps the
 * prompt that produced it, so she can watch her own prompting improve. That
 * is the pedagogical reason the version history exists at all, and it is why
 * a version is never overwritten.
 *
 * Introduced by migration 0001_segel.
 */
export const artifact = pgTable(
  "artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    voyageId: text("voyage_id").notNull(),
    stationId: text("station_id").notNull(),
    title: text("title").notNull(),
    /** Which version is shown in the gallery. */
    currentVersion: integer("current_version").notNull().default(1),
    shown: boolean("shown").notNull().default(false),
  },
  (table) => [index("artifact_created_idx").on(table.createdAt)],
)

export const artifactVersion = pgTable(
  "artifact_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifact.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Her words that produced this version. The reason the table exists. */
    prompt: text("prompt").notNull(),
    html: text("html").notNull(),
    model: text("model"),
    escalated: boolean("escalated").notNull().default(false),
  },
  (table) => [unique("artifact_version_unique").on(table.artifactId, table.version)],
)

export type ArtifactRow = typeof artifact.$inferSelect
export type ArtifactVersionRow = typeof artifactVersion.$inferSelect

/**
 * Parent-controlled knobs: the caps and the kill switch.
 *
 * A key-value table rather than columns, because these are settings the
 * parent flips, not data the app reasons about — and because adding the next
 * one should not need a migration. Defaults live in code, so an empty table
 * is a working app.
 *
 * Introduced by migration 0001_segel.
 */
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Minutes used, per day, so the caps can be enforced on the server.
 *
 * Client-side timers are a suggestion; this is the enforcement. Activity is
 * stamped on every model call, and a gap longer than the idle window starts
 * a new session — which is how a 40-minute *session* cap and a daily cap can
 * both come out of one row.
 *
 * Introduced by migration 0001_segel.
 */
export const usageDay = pgTable("usage_day", {
  /** ISO date, local to the operator. Primary key: one row per day. */
  day: text("day").primaryKey(),
  activeMinutes: integer("active_minutes").notNull().default(0),
  sessionMinutes: integer("session_minutes").notNull().default(0),
  sessionStartedAt: timestamp("session_started_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  calls: integer("calls").notNull().default(0),
})

export type UsageDayRow = typeof usageDay.$inferSelect
