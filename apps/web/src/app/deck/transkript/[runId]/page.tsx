import Link from "next/link"
import { notFound } from "next/navigation"
import { Deckhead } from "@/components/deckhead"
import { stationById, voyageBySlug } from "@/content/voyages"
import { messagesFor, runById } from "@/db/segel"
import { deckUnlocked } from "@/lib/deck-gate"

export const dynamic = "force-dynamic"

/**
 * One station's conversation, in full.
 *
 * Including the turns a filter stopped, which is the point — "what did she try
 * to type" and "what did the model try to say" are exactly the two questions
 * a parent has, and they are the two a filtered transcript cannot answer.
 * Blocked turns are marked rather than hidden.
 */
export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  if (!(await deckUnlocked())) {
    return (
      <>
        <Deckhead />
        <main>
          <h1>Abgeschlossen</h1>
          <p>
            <Link href="/deck">Zum Kapitäns-Deck</Link>
          </p>
        </main>
      </>
    )
  }

  const { runId } = await params
  const run = await runById(runId)
  if (!run) notFound()

  const turns = await messagesFor(runId)
  const voyage = voyageBySlug(run.voyageSlug)
  const station = voyage ? stationById(voyage, run.stationId) : undefined

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">
          {run.startedAt.toLocaleString("de-DE")}
          {run.completedAt ? " · abgeschlossen" : " · offen geblieben"}
        </p>
        <h1>{station?.title ?? run.stationId}</h1>
        <p className="lead muted">
          {voyage?.title ?? run.voyageSlug}
          {station ? ` — ${station.successCondition}` : ""}
        </p>

        {turns.length === 0 ? (
          <p className="muted">Nichts gesagt worden.</p>
        ) : (
          <div className="turns">
            {turns.map((turn) => (
              <div
                className="turn"
                key={turn.id}
                data-role={turn.role}
                data-blocked={turn.blocked ? "true" : "false"}
              >
                <span className="turn-who">
                  {turn.role === "segler" ? "Sie" : "Modell"}
                  {turn.servedBy ? ` · ${turn.servedBy}` : ""}
                  {turn.blocked ? ` · zurückgehalten (${turn.blockReason ?? "Filter"})` : ""}
                </span>
                {turn.content}
              </div>
            ))}
          </div>
        )}

        <p>
          <Link href="/deck">Zurück zum Deck</Link>
        </p>
      </main>
    </>
  )
}
