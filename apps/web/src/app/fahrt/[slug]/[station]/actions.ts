"use server"

import { revalidatePath } from "next/cache"
import { voyageBySlug } from "@/content/voyages"
import {
  completedStationIds,
  completeRun,
  completeVoyage,
  fileLogbuchEntry,
  type LogbuchKind,
} from "@/db/segel"

/**
 * The writes a station makes when she finishes something.
 *
 * Server actions rather than API routes: none of these calls a model, they all
 * end in a revalidate, and a form that works without JavaScript is one less
 * thing to go wrong on a slow laptop.
 *
 * Co-located with the route they belong to. Anything that needed to be shared
 * beyond this route would move to src/server/ — nothing does yet.
 */

/**
 * Files a catch, which is the single most important write in the app.
 *
 * `score: 1` marks it as one she found herself — the metric in the spec is
 * *unprompted* catches per session, and every catch that reaches this function
 * is one she pressed the button for. If a "show me a hint" affordance is ever
 * added, its catches must score 0, or the metric quietly stops measuring the
 * thing it is named after.
 */
export async function fileCatch(input: {
  voyageSlug: string
  stationId: string
  runId: string
  quote: string
  why: string
}): Promise<void> {
  await fileLogbuchEntry({
    kind: "catch",
    voyageSlug: input.voyageSlug,
    stationId: input.stationId,
    runId: input.runId,
    title: input.why.trim() || "Ohne Begründung gefangen",
    quote: input.quote,
    score: 1,
  })

  revalidatePath("/")
}

/** Rankings, quiz results, plate rounds, builds — everything else that earns a line. */
export async function fileEntry(input: {
  kind: Exclude<LogbuchKind, "catch">
  voyageSlug: string
  stationId: string
  runId?: string
  title: string
  detail?: string
}): Promise<void> {
  await fileLogbuchEntry({
    kind: input.kind,
    voyageSlug: input.voyageSlug,
    stationId: input.stationId,
    runId: input.runId,
    title: input.title,
    detail: input.detail,
  })

  revalidatePath("/")
}

/**
 * Closes a station, and the voyage with it when that was the last one.
 *
 * The voyage completes here rather than behind its own button, because a
 * button she has to find is a button she will not find — and a voyage that
 * never completes leaves the Logbuch permanently mid-sentence.
 */
export async function finishStation(voyageSlug: string, runId: string): Promise<void> {
  await completeRun(runId)

  const voyage = voyageBySlug(voyageSlug)
  if (!voyage) return

  const done = await completedStationIds(voyageSlug)
  if (voyage.stations.every((station) => done.includes(station.id))) {
    await completeVoyage(voyageSlug, null)
  }

  revalidatePath("/")
  revalidatePath(`/fahrt/${voyageSlug}`)
}
