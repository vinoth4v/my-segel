import { signOutAction } from "@/app/actions"
import { lockDeck, unlockDeck, updateSetting } from "@/app/deck/actions"
import { Markdown } from "@/app/markdown"
import { Masthead } from "@/app/masthead"
import { voyages } from "@/segel/content"
import { deckUnlocked } from "@/segel/deck-lock"
import {
  escalations,
  flagged,
  logbuch,
  progress,
  settings,
  transcriptFor,
  usageRecent,
} from "@/segel/store"

export const dynamic = "force-dynamic"

/**
 * Kapitäns-Deck: what she has been told, how far she has got, and the two
 * knobs the parent actually needs.
 *
 * Behind its own password prompt — see segel/deck-lock.ts for why a
 * single-account app still needs a second lock.
 */
export default async function DeckPage() {
  if (!(await deckUnlocked())) return <Locked />

  const [entries, done, calls, escalated, filtered, days, config] = await Promise.all([
    logbuch(200).catch(() => []),
    progress().catch(() => []),
    transcriptFor(undefined, 120).catch(() => []),
    escalations(25).catch(() => []),
    flagged(25).catch(() => []),
    usageRecent(14).catch(() => []),
    settings(),
  ])

  const all = voyages()
  const catches = entries.filter((entry) => entry.kind === "catch")
  const completed = new Set(
    done.filter((row) => row.completedAt).map((row) => `${row.voyageId}/${row.stationId}`),
  )

  // Catches per day, which is the metric the whole thing is judged on: not
  // how many, but whether the number is rising.
  const perDay = new Map<string, number>()
  for (const entry of catches) {
    const day = entry.at.toISOString().slice(0, 10)
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  const trend = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14)
  const busiest = Math.max(1, ...trend.map(([, count]) => count))

  return (
    <main>
      <Masthead here="deck" />

      <p className="chart-label">Kapitäns-Deck</p>
      <h1>Was läuft</h1>

      <h2>Fänge pro Tag</h2>
      {trend.length === 0 ? (
        <p className="muted">Noch keine Fänge. Die kommen in Fahrt 2.</p>
      ) : (
        <table>
          <tbody>
            {trend.map(([day, count]) => (
              <tr key={day}>
                <th scope="row">{day}</th>
                <td style={{ width: "100%" }}>
                  <div className="meter">
                    <span style={{ width: `${Math.round((count / busiest) * 100)}%` }} />
                  </div>
                </td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">
        Die Zahl, auf die es ankommt, ist nicht die Höhe, sondern die Richtung: ungefragte Fänge pro
        Sitzung sollten über die Wochen steigen.
      </p>

      <h2>Fortschritt</h2>
      <table>
        <thead>
          <tr>
            <th>Fahrt</th>
            <th>Stationen</th>
            <th>Zeit</th>
          </tr>
        </thead>
        <tbody>
          {all.map((voyage) => {
            const finished = voyage.stations.filter((station) =>
              completed.has(`${voyage.id}/${station.id}`),
            ).length
            return (
              <tr key={voyage.id}>
                <th scope="row">
                  {voyage.number}. {voyage.title}
                </th>
                <td>
                  {finished} von {voyage.stations.length}
                </td>
                <td>{voyage.twoSeater ? "zu zweit" : `${voyage.estMinutes} min`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Zeit</h2>
      <table>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Minuten</th>
            <th>Aufrufe</th>
          </tr>
        </thead>
        <tbody>
          {days.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">
                Noch nichts.
              </td>
            </tr>
          ) : (
            days.map((day) => (
              <tr key={day.day}>
                <th scope="row">{day.day}</th>
                <td>{day.activeMinutes}</td>
                <td>{day.calls}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="muted">
        Zeit in der App ist die Anti-Kennzahl. Wenn sie hier zwei Stunden stehen hat, ist etwas
        schiefgegangen, egal wie gut die anderen Zahlen aussehen.
      </p>

      <h2>Regler</h2>
      <div className="card stack">
        <form action={updateSetting} className="row">
          <input type="hidden" name="key" value="paused" />
          <input type="hidden" name="value" value={config.paused >= 1 ? 0 : 1} />
          <button type="submit" className={config.paused >= 1 ? "" : "quiet"}>
            {config.paused >= 1 ? "Segel ist angehalten — weiterlaufen lassen" : "Segel anhalten"}
          </button>
        </form>

        {(
          [
            ["sessionCapMinutes", "Minuten pro Sitzung"],
            ["dailyCapMinutes", "Minuten pro Tag"],
            ["idleResetMinutes", "Pause, die eine neue Sitzung beginnt"],
          ] as const
        ).map(([key, label]) => (
          <form action={updateSetting} className="row" key={key}>
            <input type="hidden" name="key" value={key} />
            <label htmlFor={key} style={{ flex: "0 0 18rem", marginBottom: 0 }}>
              {label}
            </label>
            <input
              id={key}
              name="value"
              type="number"
              min="0"
              defaultValue={config[key]}
              style={{ width: "6rem" }}
            />
            <button type="submit" className="quiet">
              Speichern
            </button>
          </form>
        ))}
      </div>

      <h2>Eskalationen</h2>
      <p className="muted">
        Wo ein freies Modell nicht gereicht hat. Das ist die einzige Stelle, an der laufende Kosten
        entstehen — sichtbar statt still.
      </p>
      {escalated.length === 0 ? (
        <p className="muted">Keine. Bisher haben die freien Modelle gereicht.</p>
      ) : (
        <table>
          <tbody>
            {escalated.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.at.toLocaleString("de-DE")}</th>
                <td>{row.stationType}</td>
                <td>{row.servedBy || row.model}</td>
                <td className="muted">{row.escalationReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Gefiltert</h2>
      <p className="muted">
        Was der Ein- oder Ausgabefilter angehalten hat. Leer ist der Normalfall; mehrere Einträge in
        einer Woche sind ein Gesprächsanlass.
      </p>
      {filtered.length === 0 ? (
        <p className="muted">Nichts.</p>
      ) : (
        <table>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.at.toLocaleString("de-DE")}</th>
                <td>{row.flagReason}</td>
                <td className="muted">{row.content.slice(0, 160)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Notizen zu den Fahrten</h2>
      {all.map((voyage) => (
        <details key={voyage.id} className="card" style={{ marginBottom: "var(--space-3)" }}>
          <summary>
            {voyage.number}. {voyage.title}
          </summary>
          <Markdown text={voyage.debrief.parentNote} />
        </details>
      ))}

      <h2>Mitschrift</h2>
      <p className="muted">
        Alles, was gesagt wurde, neueste zuerst. Nichts davon kann sie löschen.
      </p>
      <div className="ledger">
        {calls.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Noch nichts.
          </p>
        ) : (
          calls.map((row) => (
            <article className="ledger-row" key={row.id}>
              <span className="ledger-date">
                {row.at.toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div>
                <span className="turn-who">
                  {row.role === "kind"
                    ? "Sie"
                    : row.role === "modell"
                      ? row.servedBy || "Modell"
                      : "System"}
                  {" · "}
                  {row.voyageId}/{row.stationId}
                </span>
                <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{row.content}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="row" style={{ marginTop: "var(--space-8)" }}>
        <form action={lockDeck}>
          <button type="submit" className="quiet">
            Deck abschliessen
          </button>
        </form>
        <form action={signOutAction}>
          <button type="submit" className="quiet">
            Abmelden
          </button>
        </form>
      </div>
    </main>
  )
}

function Locked() {
  return (
    <main>
      <Masthead here="deck" />
      <p className="chart-label">Kapitäns-Deck</p>
      <h1>Nur für Papa</h1>
      <p className="muted">
        Hier stehen alle Mitschriften und die Regler. Zum Öffnen noch einmal das Passwort.
      </p>
      <form action={unlockDeck} className="stack" style={{ maxWidth: "22rem" }}>
        <label htmlFor="password">Passwort</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div>
          <button type="submit">Aufschliessen</button>
        </div>
      </form>
    </main>
  )
}
