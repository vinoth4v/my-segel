import Link from "next/link"
import { VoyageArt } from "@/app/illustrations"
import { Masthead } from "@/app/masthead"
import { voyages } from "@/segel/content"
import { logbuch, progress } from "@/segel/store"

// Reads the session cookie and her progress, so there is nothing to prerender.
export const dynamic = "force-dynamic"

/**
 * The Logbuch, and the home page — deliberately the same thing.
 *
 * The spec is explicit that this is not a subpage, and the reason is the
 * retention mechanic: what she sees on opening the app is the accumulating
 * evidence of her own work, not a menu of lessons still to do. The stamps
 * are the point. The voyage list is underneath them.
 */
export default async function LogbuchPage() {
  const all = voyages()

  // A first run has no database yet, and a home page that 500s because
  // nothing has happened is a bad first impression. Empty is the honest
  // answer to "what have you caught so far" on day one.
  const [entries, done] = await Promise.all([
    logbuch(60).catch(() => []),
    progress().catch(() => []),
  ])

  const catches = entries.filter((entry) => entry.kind === "catch")
  const completed = new Set(
    done.filter((row) => row.completedAt).map((row) => `${row.voyageId}/${row.stationId}`),
  )

  return (
    <main>
      <Masthead here="logbuch" />

      <p className="chart-label">Logbuch</p>
      <h1>Was du gefangen hast</h1>

      {catches.length === 0 ? (
        <p className="muted">
          Noch nichts gestempelt. Das kommt in Fahrt 2 — da fängst du das Modell beim Erfinden.
        </p>
      ) : (
        <p className="muted">
          {catches.length === 1 ? "Ein gefangener Fehler." : `${catches.length} gefangene Fehler.`}{" "}
          Jeder einzelne war eine Antwort, die überzeugend klang und trotzdem falsch war.
        </p>
      )}

      <div className="ledger">
        {entries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Die Seiten sind noch leer.
          </p>
        ) : (
          entries.map((entry) => (
            <article className="ledger-row" key={entry.id}>
              <span className="ledger-date">
                {entry.at.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
              </span>
              {entry.kind === "catch" ? (
                <span className="stamp" role="img" aria-label="Gefangen">
                  Fang
                </span>
              ) : (
                <span
                  className="stamp"
                  role="img"
                  aria-label={KIND_LABEL[entry.kind] ?? entry.kind}
                >
                  {KIND_SHORT[entry.kind] ?? "Notiz"}
                </span>
              )}
              <div>
                <h3>{entry.title}</h3>
                {entry.why ? <p style={{ margin: 0 }}>„{entry.why}“</p> : null}
                {entry.detail && entry.kind === "catch" ? (
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {entry.detail.slice(0, 220)}
                    {entry.detail.length > 220 ? "…" : ""}
                  </p>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      {/* Counted, not spelled: the curriculum is data, and a heading that
          says "six" while eleven are listed is the app telling her something
          untrue on the home page. */}
      <h2>Deine Fahrten</h2>
      <ul className="voyage-list">
        {all.map((voyage) => {
          const stations = voyage.stations.length
          const finished = voyage.stations.filter((station) =>
            completed.has(`${voyage.id}/${station.id}`),
          ).length
          const complete = finished === stations

          return (
            <li key={voyage.id}>
              <Link
                className={`voyage${complete ? " voyage-done" : ""}`}
                href={`/reise/${voyage.id}`}
              >
                <span className="voyage-number">{voyage.number}</span>
                <VoyageArt name={voyage.intro.illustration} className="art-thumb" />
                <span>
                  <strong>{voyage.title}</strong>
                  <br />
                  <span className="muted">{voyage.subtitle}</span>
                </span>
                <span className="muted" style={{ marginLeft: "auto", textAlign: "right" }}>
                  {complete ? "fertig" : `${finished} von ${stations}`}
                  <br />
                  {voyage.twoSeater ? "zu zweit" : `${voyage.estMinutes} min`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

const KIND_LABEL: Record<string, string> = {
  ranking: "Modelle sortiert",
  build: "Gebaut",
  note: "Notiz",
}

const KIND_SHORT: Record<string, string> = {
  ranking: "Zoo",
  build: "Bau",
  note: "Notiz",
}
