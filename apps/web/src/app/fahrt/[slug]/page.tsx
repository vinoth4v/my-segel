import Link from "next/link"
import { notFound } from "next/navigation"
import { Deckhead } from "@/components/deckhead"
import { Markdown } from "@/components/markdown"
import { voyageBySlug } from "@/content/voyages"
import { completedStationIds } from "@/db/segel"
import { safely } from "@/lib/safely"

export const dynamic = "force-dynamic"

const STATION_KIND: Record<string, string> = {
  talk: "Gespräch",
  jagd: "Jagd",
  zoo: "Zoo",
  labor: "Labor",
  werkstatt: "Werkstatt",
  echt: "Bilder",
  quiz: "Check",
}

export default async function VoyagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const voyage = voyageBySlug(slug)
  if (!voyage) notFound()

  const done = await safely(() => completedStationIds(voyage.slug), [])

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">
          Fahrt {voyage.id} · {voyage.estMinutes} Minuten
          {voyage.twoSeater ? " · zu zweit" : ""}
        </p>
        <h1>{voyage.title}</h1>
        <p className="lead muted">{voyage.subtitle}</p>

        {voyage.twoSeater ? (
          <p className="notice">
            Diese Fahrt ist zu zweit gedacht. Hol Papa dazu, bevor du anfängst.
          </p>
        ) : null}

        <section className="panel">
          <Markdown source={voyage.intro.markdown} />
        </section>

        <section>
          <p className="chartlabel">Stationen</p>
          <ul className="voyages">
            {voyage.stations.map((station, index) => {
              const finished = done.includes(station.id)
              return (
                <li key={station.id}>
                  <Link
                    href={`/fahrt/${voyage.slug}/${station.id}`}
                    className="voyage"
                    data-state={finished ? "done" : "new"}
                  >
                    <span className="voyage-number">{index + 1}</span>
                    <span>
                      <h3>{station.title}</h3>
                      <p>
                        {STATION_KIND[station.type] ?? station.type} · {station.estMinutes} min
                      </p>
                    </span>
                    <span className="muted">
                      {finished ? <span className="stamp">Fertig</span> : "offen"}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        {done.length === voyage.stations.length ? (
          <section className="panel">
            <p className="chartlabel">Nachbesprechung</p>
            <p>Alle Stationen gefahren. Diese Fragen sind zum Reden, nicht zum Tippen:</p>
            <ul>
              {voyage.debrief.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <p>
          <Link href="/">Zurück zum Logbuch</Link>
        </p>
      </main>
    </>
  )
}
