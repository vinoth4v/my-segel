import Link from "next/link"
import { notFound } from "next/navigation"
import { Markdown } from "@/app/markdown"
import { Masthead } from "@/app/masthead"
import { voyageById, voyages } from "@/segel/content"
import { progress } from "@/segel/store"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return voyages().map((voyage) => ({ voyageId: voyage.id }))
}

/** A voyage: what this week is about, and the stations in it. */
export default async function VoyagePage({ params }: { params: Promise<{ voyageId: string }> }) {
  const { voyageId } = await params
  const voyage = voyageById(voyageId)
  if (!voyage) notFound()

  const done = await progress().catch(() => [])
  const completed = new Set(
    done.filter((row) => row.completedAt).map((row) => `${row.voyageId}/${row.stationId}`),
  )

  return (
    <main>
      <Masthead />

      <p className="chart-label">Fahrt {voyage.number}</p>
      <h1>{voyage.title}</h1>
      <p className="muted">{voyage.subtitle}</p>

      {voyage.twoSeater ? (
        // Said plainly rather than hinted at: the spec makes some weeks
        // deliberately two-seater, and a week done alone that was meant to be
        // done together is a week that half worked.
        <p className="card">
          <strong>Diese Fahrt ist zu zweit.</strong> Hol Papa dazu, bevor du anfängst.
        </p>
      ) : null}

      <Markdown text={voyage.intro.markdown} />

      <h2>Stationen</h2>
      <ul className="voyage-list">
        {voyage.stations.map((station, index) => {
          const complete = completed.has(`${voyage.id}/${station.id}`)
          return (
            <li key={station.id}>
              <Link
                className={`voyage${complete ? " voyage-done" : ""}`}
                href={`/reise/${voyage.id}/${station.id}`}
              >
                <span className="voyage-number">{index + 1}</span>
                <span>
                  <strong>{station.title}</strong>
                  <br />
                  <span className="muted">{station.intro}</span>
                </span>
                {complete ? (
                  <span
                    className="stamp"
                    role="img"
                    style={{ marginLeft: "auto" }}
                    aria-label="Fertig"
                  >
                    ✓
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>

      <h2>Danach redet ihr darüber</h2>
      <ul>
        {voyage.debrief.questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <p className="muted">
        Die Notiz für Papa zu dieser Fahrt steht im <Link href="/deck">Kapitäns-Deck</Link>.
      </p>
    </main>
  )
}
