import {
  boolean,
  index,
  integer,
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
 * Every row Segel owns carries a `learner`.
 *
 * There is exactly one learner and there is no learner table, so this column
 * is a constant today — which makes it look like dead weight. It is not. It is
 * the row-ownership pattern kept deliberately: every query filters on it, so
 * the day a second child exists the change is a real user store and a new
 * value in this column, not a rewrite of every query in the app. Removing it
 * is cheap now and expensive later, which is the wrong way round.
 */
export const SEGLER = "segler"

/**
 * One visit to one station.
 *
 * The unit the transcript hangs off: the parent deck reads runs, not messages,
 * because "what did she do on Tuesday" is a question about stations.
 */
export const stationRun = pgTable(
  "station_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learner: text("learner").notNull().default(SEGLER),
    voyageSlug: text("voyage_slug").notNull(),
    stationId: text("station_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("station_run_learner_started_idx").on(table.learner, table.startedAt),
    index("station_run_voyage_idx").on(table.voyageSlug, table.stationId),
  ],
)

/**
 * Every turn of every conversation, hers and the model's.
 *
 * Never deleted by the child, and there is no UI that offers to. Full
 * transcript retention is half of what makes the app handable — the parent's
 * side of the bargain is that they can read all of it, which only works if
 * none of it can quietly go missing.
 */
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => stationRun.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** "segler" or "schiff" — her, or the model. */
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** The lane or pin asked for, and what the gateway actually used. */
    model: text("model"),
    servedBy: text("served_by"),
    /**
     * True when a filter stopped this turn. The row is still written, with the
     * original text, because "what did it try to say" is exactly what the
     * parent needs to see — the filter hides it from her, not from them.
     */
    blocked: boolean("blocked").notNull().default(false),
    blockReason: text("block_reason"),
  },
  (table) => [index("message_run_at_idx").on(table.runId, table.at)],
)

/**
 * The Logbuch. Caught errors, ranked models, finished builds.
 *
 * The retention mechanic and the success metric in one table: "unprompted
 * catches per session, trending up over six weeks" is a query against this.
 */
export const logbuchEntry = pgTable(
  "logbuch_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learner: text("learner").notNull().default(SEGLER),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** "catch" | "ranking" | "build" | "quiz" | "echt" */
    kind: text("kind").notNull(),
    voyageSlug: text("voyage_slug").notNull(),
    stationId: text("station_id").notNull(),
    /** One line, in her words where possible. */
    title: text("title").notNull(),
    /** The evidence: what was said, and why she thought it was wrong. */
    detail: text("detail"),
    /** What the model claimed, kept verbatim so a catch can be re-read later. */
    quote: text("quote"),
    /** 1 for a catch she found unprompted, which is the number that matters. */
    score: integer("score").notNull().default(0),
    runId: uuid("run_id").references(() => stationRun.id, { onDelete: "set null" }),
  },
  (table) => [index("logbuch_learner_at_idx").on(table.learner, table.at)],
)

/** A thing she built. The container; the versions carry the content. */
export const artifact = pgTable(
  "artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learner: text("learner").notNull().default(SEGLER),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("artifact_learner_updated_idx").on(table.learner, table.updatedAt)],
)

/**
 * Every version, with the sentence that produced it.
 *
 * Lifted from replforge's checkpoint model, and it earns a second job here it
 * never had there: scrubbing back through the versions shows her that her own
 * descriptions got sharper. That only works if the prompt is stored beside the
 * output, so the prompt column is the point of this table, not metadata on it.
 */
export const artifactVersion = pgTable(
  "artifact_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifact.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    prompt: text("prompt").notNull(),
    html: text("html").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** True when a free model failed and this came from the paid one. */
    escalated: boolean("escalated").notNull().default(false),
    servedBy: text("served_by"),
  },
  (table) => [unique("artifact_version_unique").on(table.artifactId, table.version)],
)

/**
 * Every time a free model failed and a paid one finished the job.
 *
 * "Zero surprise costs" is a promise to the parent, and a promise about money
 * is only keepable if the spending is countable. This is that count.
 */
export const escalation = pgTable(
  "escalation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    station: text("station").notNull(),
    fromModel: text("from_model").notNull(),
    toModel: text("to_model").notNull(),
    reason: text("reason").notNull(),
  },
  (table) => [index("escalation_at_idx").on(table.at)],
)

/** One row per voyage she has started. Completion is a timestamp, not a flag. */
export const voyageProgress = pgTable(
  "voyage_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learner: text("learner").notNull().default(SEGLER),
    voyageSlug: text("voyage_slug").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Her own answers to the debrief questions, one per line. */
    debrief: text("debrief"),
  },
  (table) => [unique("voyage_progress_unique").on(table.learner, table.voyageSlug)],
)

/**
 * Server-side session accounting for the caps.
 *
 * Kept in the database rather than a cookie precisely because the child must
 * not be able to clear it. A window is opened on her first request and touched
 * on every one after; the cap is arithmetic over these rows.
 */
export const sessionWindow = pgTable(
  "session_window",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learner: text("learner").notNull().default(SEGLER),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("session_window_learner_started_idx").on(table.learner, table.startedAt)],
)

/**
 * The few things the parent can change without a deploy: the session cap, the
 * daily cap, and the kill switch.
 *
 * A key/value table rather than columns because there are three of them and
 * they are read as a group. Anything that grows past a handful of keys should
 * become real columns instead.
 */
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type StationRunRow = typeof stationRun.$inferSelect
export type MessageRow = typeof message.$inferSelect
export type LogbuchEntryRow = typeof logbuchEntry.$inferSelect
export type ArtifactRow = typeof artifact.$inferSelect
export type ArtifactVersionRow = typeof artifactVersion.$inferSelect
export type EscalationRow = typeof escalation.$inferSelect
export type VoyageProgressRow = typeof voyageProgress.$inferSelect
export type SettingRow = typeof setting.$inferSelect
