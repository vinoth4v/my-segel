import Link from "next/link"
import { notFound } from "next/navigation"
import { Masthead } from "@/app/masthead"
import { EchtStation } from "@/app/stations/echt"
import { LaborStation } from "@/app/stations/labor"
import { QuizStation } from "@/app/stations/quiz"
import { TalkStation } from "@/app/stations/talk"
import { WerkstattStation } from "@/app/stations/werkstatt"
import { ZooStation } from "@/app/stations/zoo"
import { stationIn, stationPosition, voyageById } from "@/segel/content"

export const dynamic = "force-dynamic"

/**
 * One station.
 *
 * The server resolves which station this is and hands the whole validated
 * object to a client component. The station components take content as a
 * prop rather than fetching it, so the curriculum stays data that flows in
 * one direction: JSON, schema, page.
 */
export default async function StationPage({
  params,
}: {
  params: Promise<{ voyageId: string; stationId: string }>
}) {
  const { voyageId, stationId } = await params
  const voyage = voyageById(voyageId)
  const station = voyage && stationIn(voyage, stationId)
  if (!voyage || !station) notFound()

  const { index, total, next } = stationPosition(voyage, station.id)

  return (
    <main>
      <Masthead />

      <p className="chart-label">
        <Link href={`/reise/${voyage.id}`}>Fahrt {voyage.number}</Link> · Station {index + 1} von{" "}
        {total}
      </p>
      <h1>{station.title}</h1>
      <p className="muted">{station.intro}</p>

      {station.type === "talk" || station.type === "jagd" ? (
        <TalkStation voyageId={voyage.id} station={station} />
      ) : null}
      {station.type === "zoo" ? <ZooStation voyageId={voyage.id} station={station} /> : null}
      {station.type === "labor" ? <LaborStation voyageId={voyage.id} station={station} /> : null}
      {station.type === "werkstatt" ? (
        <WerkstattStation voyageId={voyage.id} station={station} />
      ) : null}
      {station.type === "quiz" ? <QuizStation voyageId={voyage.id} station={station} /> : null}
      {station.type === "echt" ? <EchtStation voyageId={voyage.id} station={station} /> : null}

      <p className="muted" style={{ marginTop: "var(--space-8)" }}>
        <strong>Geschafft, wenn:</strong> {station.success}
      </p>

      <p>
        {next ? (
          <Link href={`/reise/${voyage.id}/${next.id}`}>Weiter zu „{next.title}“ →</Link>
        ) : (
          <Link href={`/reise/${voyage.id}`}>Zurück zur Fahrt →</Link>
        )}
      </p>
    </main>
  )
}
