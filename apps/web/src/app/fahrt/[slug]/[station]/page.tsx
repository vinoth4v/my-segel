import Link from "next/link"
import { notFound } from "next/navigation"
import { Deckhead } from "@/components/deckhead"
import { EchtStation } from "@/components/stations/echt-station"
import { JagdStation } from "@/components/stations/jagd-station"
import { LaborStation } from "@/components/stations/labor-station"
import { QuizStation } from "@/components/stations/quiz-station"
import { TalkStation } from "@/components/stations/talk-station"
import { WerkstattStation } from "@/components/stations/werkstatt-station"
import { ZooStation } from "@/components/stations/zoo-station"
import { stationById, voyageBySlug } from "@/content/voyages"
import { startRun } from "@/db/segel"
import { gate } from "@/lib/limits"
import { FinishStation } from "./finish"

export const dynamic = "force-dynamic"

/**
 * The station player.
 *
 * The run is opened here, on the server, and its id is handed to the client
 * component — which is why no station component can invent one. Every model
 * call is keyed to a run, every run belongs to a station, and the station
 * decides which model answers. That chain is what stops the browser having any
 * say in the routing, and the routing is the curriculum.
 *
 * The cap is checked here too, so a session that is over says so on arrival
 * rather than after she has typed a question and pressed send.
 */
export default async function StationPage({
  params,
}: {
  params: Promise<{ slug: string; station: string }>
}) {
  const { slug, station: stationId } = await params

  const voyage = voyageBySlug(slug)
  const station = voyage ? stationById(voyage, stationId) : undefined
  if (!voyage || !station) notFound()

  const open = await gate()

  if (!open.open) {
    return (
      <>
        <Deckhead />
        <main>
          <p className="chartlabel">Fahrt {voyage.id}</p>
          <h1>{station.title}</h1>
          <p className="notice">{open.message}</p>
          <p>
            <Link href="/">Zurück zum Logbuch</Link>
          </p>
        </main>
      </>
    )
  }

  const runId = await startRun(voyage.slug, station.id)

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">
          Fahrt {voyage.id} · {voyage.title} · {station.estMinutes} min
        </p>
        <h1>{station.title}</h1>
        <p className="lead">{station.instruction}</p>

        {station.type === "jagd" ? (
          <p className="notice">
            Achtung: hier antwortet mit Absicht ein schwaches Modell. Es liegt oft daneben, und es
            klingt dabei genauso sicher wie ein gutes.
          </p>
        ) : null}

        {station.type === "talk" ? <TalkStation runId={runId} station={station} /> : null}
        {station.type === "jagd" ? (
          <JagdStation runId={runId} voyageSlug={voyage.slug} station={station} />
        ) : null}
        {station.type === "zoo" ? (
          <ZooStation runId={runId} voyageSlug={voyage.slug} station={station} />
        ) : null}
        {station.type === "labor" ? <LaborStation runId={runId} station={station} /> : null}
        {station.type === "werkstatt" ? (
          <WerkstattStation runId={runId} voyageSlug={voyage.slug} station={station} />
        ) : null}
        {station.type === "echt" ? (
          <EchtStation runId={runId} voyageSlug={voyage.slug} station={station} />
        ) : null}
        {station.type === "quiz" ? (
          <QuizStation runId={runId} voyageSlug={voyage.slug} station={station} />
        ) : null}

        <FinishStation voyageSlug={voyage.slug} runId={runId} />

        <p>
          <Link href={`/fahrt/${voyage.slug}`}>Zurück zur Fahrt</Link>
        </p>
      </main>
    </>
  )
}
