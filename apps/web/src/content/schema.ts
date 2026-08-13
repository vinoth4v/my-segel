import { z } from "zod"

/**
 * The curriculum's shape.
 *
 * The six voyages are JSON in `content/voyages/`, not components, because the
 * curriculum is the part of this app most likely to change and the part least
 * likely to need a programmer. A voyage can be rewritten, reordered or added
 * to by editing one file; the station player reads whatever is there.
 *
 * The schema is strict on purpose. A typo in a station type would otherwise
 * render an empty page in front of a ten-year-old mid-session, which is the
 * one failure that costs more than a build error — so it fails at the test,
 * where `voyages.test.ts` parses all six.
 */

/** Every station kind the player knows how to render. */
export const STATION_TYPES = [
  "talk",
  "jagd",
  "zoo",
  "labor",
  "werkstatt",
  "echt",
  "quiz",
] as const

export type StationType = (typeof STATION_TYPES)[number]

const baseStation = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Shown to her before the station starts. Two or three sentences, du-form. */
  instruction: z.string().min(1),
  estMinutes: z.number().int().positive().max(30),
  /**
   * What "done" means, in words. Not machine-checked — it is the sentence the
   * debrief and the parent note are written against, and writing it down is
   * what stops a station from being a toy with no point.
   */
  successCondition: z.string().min(1),
})

/** Scoped conversation. The chips exist so she never faces an empty box. */
const talkStation = baseStation.extend({
  type: z.literal("talk"),
  /** Appended to the global safety prompt — the station's own brief. */
  systemScaffold: z.string().min(1),
  chips: z.array(z.string().min(1)).min(2).max(8),
})

/** The hallucination hunt. Each target is bait a weak model reliably takes. */
const jagdStation = baseStation.extend({
  type: z.literal("jagd"),
  systemScaffold: z.string().min(1),
  targets: z
    .array(
      z.object({
        label: z.string().min(1),
        /**
         * Empty means the bait is hers to write — the "ask about your own
         * subject" target, which is the most productive one and cannot be
         * pre-written because only she knows what she is expert in.
         */
        prompt: z.string(),
        /** Why this one works — parent-facing, never shown to her. */
        why: z.string().min(1),
      }),
    )
    .min(3),
})

/** One prompt, three models, blind. */
const zooStation = baseStation.extend({
  type: z.literal("zoo"),
  prompts: z.array(z.string().min(1)).min(3),
  revealNote: z.string().min(1),
})

/** Her prompt against a version she assembles from levers. */
const laborStation = baseStation.extend({
  type: z.literal("labor"),
  task: z.string().min(1),
  levers: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        hint: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
      }),
    )
    .min(3),
})

/** She describes a thing; the app builds it. */
const werkstattStation = baseStation.extend({
  type: z.literal("werkstatt"),
  ideas: z.array(z.string().min(1)).min(3),
})

/** Real or generated, then the tells. Plates are drawn in-repo — see plates.ts. */
const echtStation = baseStation.extend({
  type: z.literal("echt"),
  plateIds: z.array(z.string().min(1)).min(4),
})

const quizStation = baseStation.extend({
  type: z.literal("quiz"),
  questions: z
    .array(
      z.object({
        q: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        answerIndex: z.number().int().nonnegative(),
        why: z.string().min(1),
      }),
    )
    .min(2),
})

export const stationSchema = z.discriminatedUnion("type", [
  talkStation,
  jagdStation,
  zooStation,
  laborStation,
  werkstattStation,
  echtStation,
  quizStation,
])

export type Station = z.infer<typeof stationSchema>
export type TalkStation = z.infer<typeof talkStation>
export type JagdStation = z.infer<typeof jagdStation>
export type ZooStation = z.infer<typeof zooStation>
export type LaborStation = z.infer<typeof laborStation>
export type WerkstattStation = z.infer<typeof werkstattStation>
export type EchtStation = z.infer<typeof echtStation>
export type QuizStation = z.infer<typeof quizStation>

export const voyageSchema = z.object({
  /** 1–6. Also the order — Voyage 2 before 3 is deliberate, see ARCHITECTURE. */
  id: z.number().int().min(1).max(99),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "lowercase, digits and hyphens only — it is a URL"),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  estMinutes: z.number().int().positive().max(60),
  /** True when the voyage is meant to be done with Papa sitting next to her. */
  twoSeater: z.boolean(),
  /** One line, parent-facing: what this week is actually for. */
  teaches: z.string().min(1),
  intro: z.object({
    markdown: z.string().min(1),
    /**
     * The illustration this voyage would carry if the app had an image lane.
     * Kept in the content rather than invented later, so the art direction is
     * decided by whoever wrote the lesson. Nothing renders it today.
     */
    illustrationPrompt: z.string().min(1),
  }),
  stations: z.array(stationSchema).min(1).max(4),
  debrief: z.object({
    /** Asked of her at the end, answered in her own words. */
    questions: z.array(z.string().min(1)).min(1),
    /** Shown only on the Kapitäns-Deck: what to talk to her about. */
    parentNote: z.string().min(1),
  }),
})

export type Voyage = z.infer<typeof voyageSchema>
