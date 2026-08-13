import { z } from "zod"
import { STATION_TYPES } from "@/segel/router"

/**
 * The shape of the curriculum.
 *
 * The curriculum is data, not code — six JSON files under content/voyages,
 * validated here. That is the single most important structural decision in
 * this app: a week can be rewritten, reordered or replaced without touching a
 * component, and a model can help author a new one because the target is a
 * schema rather than a React tree.
 *
 * The schema is strict on purpose. A typo in a station type would otherwise
 * render an empty station at runtime, in front of a child, on a Sunday.
 */

const markdown = z.string().min(1)

/** A ready-made question chip, so she is not staring at an empty box. */
const seed = z.object({
  label: z.string().min(1),
  prompt: z.string().min(1),
})

const baseStation = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  /** One line telling her what she is about to do. */
  intro: markdown,
  /** Appended to the safety system prompt. Never replaces it. */
  scaffold: z.string().optional(),
  seeds: z.array(seed).default([]),
  /** What has to happen before the station counts as done. */
  success: z.string().min(1),
})

const talkStation = baseStation.extend({ type: z.literal("talk") })

const jagdStation = baseStation.extend({
  type: z.literal("jagd"),
  /** How many catches file before the station is complete. */
  targetCatches: z.number().int().min(1).max(10).default(3),
})

const zooStation = baseStation.extend({
  type: z.literal("zoo"),
  /** The one prompt all three models answer. She may edit it. */
  question: z.string().min(1),
})

const laborStation = baseStation.extend({
  type: z.literal("labor"),
  task: z.string().min(1),
  /** The levers she assembles the stronger prompt from. */
  levers: z
    .array(
      z.object({
        id: z.enum(["wer", "was", "nicht", "laenge"]),
        label: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
      }),
    )
    .min(1),
})

const werkstattStation = baseStation.extend({
  type: z.literal("werkstatt"),
  /** Ideas, for when "build anything" is too big a question. */
  ideas: z.array(z.string().min(1)).default([]),
})

const echtStation = baseStation.extend({
  type: z.literal("echt"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        /** Which in-repo scene to draw. See segel/scenes.tsx. */
        scene: z.string().min(1),
        caption: z.string().min(1),
        fake: z.boolean(),
        /** What gives it away, revealed after she picks. */
        tell: z.string().min(1),
      }),
    )
    .min(2),
})

const quizStation = baseStation.extend({
  type: z.literal("quiz"),
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        /** Index into options. */
        answer: z.number().int().min(0),
        why: z.string().min(1),
      }),
    )
    .min(1),
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

export const voyageSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    number: z.number().int().min(1).max(12),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    estMinutes: z.number().int().min(5).max(90),
    /** Some weeks are deliberately done together. The app says so. */
    twoSeater: z.boolean(),
    intro: z.object({
      markdown,
      /** What the chart illustration should show. Not rendered; authoring aid. */
      illustrationPrompt: z.string().optional(),
    }),
    stations: z.array(stationSchema).min(1).max(4),
    debrief: z.object({
      questions: z.array(z.string().min(1)).min(1),
      /** Shown only in the Kapitäns-Deck: what to talk to her about. */
      parentNote: markdown,
    }),
  })
  // Unknown keys are a mistake, not an extension point — the same reason
  // werft.json rejects them.
  .strict()

export type Voyage = z.infer<typeof voyageSchema>

export function parseVoyage(raw: unknown, source: string): Voyage {
  const parsed = voyageSchema.safeParse(raw)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    throw new Error(`${source} is not a valid voyage — ${problems}`)
  }

  const ids = new Set<string>()
  for (const station of parsed.data.stations) {
    if (ids.has(station.id)) throw new Error(`${source} repeats station id "${station.id}"`)
    ids.add(station.id)
  }

  for (const station of parsed.data.stations) {
    if (station.type === "quiz") {
      for (const question of station.questions) {
        if (question.answer >= question.options.length) {
          throw new Error(`${source} station "${station.id}" points past its options`)
        }
      }
    }
  }

  return parsed.data
}

/** Every station type the schema knows, for the exhaustiveness test. */
export const SCHEMA_STATION_TYPES = STATION_TYPES
