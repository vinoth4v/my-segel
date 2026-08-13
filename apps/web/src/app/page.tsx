import Link from "next/link"
import { Deckhead } from "@/components/deckhead"
import { voyages } from "@/content/voyages"
import { allProgress, logbuch } from "@/db/segel"
import { safely } from "@/lib/safely"

// Reads the session cookie and her progress, so there is nothing to prerender.
export const dynamic = "force-dynamic"

/**
 * The Logbuch, and the home screen.
 *
 * Deliberately not a subpage behind a dashboard. The spec's reasoning holds up
 * in use: the thing she should see on opening the app is her own accumulated
 * work — the catches she made, stamped in brass, filling a ruled page over six
 * weeks. A landing page with a "start" button would make the app the subject.
 * She is the subject.
 */
export default async function LogbuchPage() {
  const [entries, progress] = await Promise.all([
    safely(() => logbuch(60), []),
    safely(() => allProgress(), []),
  ])

  const byVoyage = new Map(progress.map((row) => [row.voyageSlug, row]))
  const catches = entries.filter((entry) => entry.kind === "catch")
  const nextUp = voyages().find((voyage) => !byVoyage.get(voyage.slug)?.completedAt)

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">Logbuch</p>
        <h1>
          {catches.length === 0
            ? "Noch keine Fänge"
            : `${catches.length} ${catches.length === 1 ? "Fang" : "Fänge"}`}
        </h1>
        <p className="lead muted">
          {catches.length === 0
            ? "Hier landet alles, was du erwischst. Fang mit Fahrt 1 an."
            : "Jeder Stempel ist ein Fehler, den du gefunden hast. Nicht das Modell. Du."}
        </p>

        <section>
          <p className="chartlabel">Die sechs Fahrten</p>
          <ul className="voyages">
            {voyages().map((voyage) => {
              const row = byVoyage.get(voyage.slug)
              const state = row?.completedAt ? "done" : row ? "underway" : "new"

              return (
                <li key={voyage.slug}>
                  <Link
                    href={`/fahrt/${voyage.slug}`}
                    className="voyage"
                    data-state={state}
                    aria-label={`Fahrt ${voyage.id}: ${voyage.title}`}
                  >
                    <span className="voyage-number">{voyage.id}</span>
                    <span>
                      <h3>{voyage.title}</h3>
                      <p>{voyage.subtitle}</p>
                    </span>
                    <span className="muted">
                      {state === "done" ? (
                        <span className="stamp">Gefahren</span>
                      ) : state === "underway" ? (
                        "unterwegs"
                      ) : (
                        `${voyage.estMinutes} min`
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {nextUp ? (
            <p>
              <Link href={`/fahrt/${nextUp.slug}`}>Weiter mit Fahrt {nextUp.id}</Link> —{" "}
              {nextUp.title}
              {nextUp.twoSeater ? <span className="two-seater"> · zu zweit</span> : null}
            </p>
          ) : (
            <p className="muted">Alle sechs Fahrten gefahren. Das Logbuch bleibt offen.</p>
          )}
        </section>

        <section>
          <p className="chartlabel">Die Seiten</p>
          {entries.length === 0 ? (
            <div className="ledger">
              <p className="muted" style={{ paddingLeft: "var(--space-12)" }}>
                Noch leer.
              </p>
            </div>
          ) : (
            <div className="ledger">
              {entries.map((entry) => (
                <div className="ledger-line" key={entry.id}>
                  <span className="ledger-date">
                    {entry.at.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                  </span>
                  <span>
                    {entry.title}
                    {entry.quote ? (
                      <span className="ledger-quote">„{truncate(entry.quote, 180)}“</span>
                    ) : null}
                    {entry.detail ? <span className="ledger-quote">{entry.detail}</span> : null}
                  </span>
                  <span>{entry.kind === "catch" ? <span className="stamp">Fang</span> : null}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`
}
