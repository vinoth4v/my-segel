import Link from "next/link"
import { signOutAction } from "@/app/actions"
import { Deckhead } from "@/components/deckhead"
import { voyageBySlug, voyages } from "@/content/voyages"
import {
  allProgress,
  catchesByDay,
  escalations,
  logbuch,
  recentRuns,
  usage,
} from "@/db/segel"
import { deckUnlocked } from "@/lib/deck-gate"
import { limits } from "@/lib/limits"
import { safely } from "@/lib/safely"
import { lockAction, saveSettingsAction, unlockAction } from "./actions"

export const dynamic = "force-dynamic"

/**
 * Kapitäns-Deck.
 *
 * Everything the parent was promised: full transcripts, progress, the catch
 * rate over time, what the free models could not do and what that escalated
 * to, the caps, and the switch that closes the app.
 *
 * Behind a re-entry of the operator password — see lib/deck-gate.ts for why
 * that is a second lock rather than a second account.
 */
export default async function DeckPage() {
  if (!(await deckUnlocked())) return <Locked />

  const [entries, progress, runs, escalated, byDay, used, config] = await Promise.all([
    safely(() => logbuch(500), []),
    safely(() => allProgress(), []),
    safely(() => recentRuns(40), []),
    safely(() => escalations(20), []),
    safely(() => catchesByDay(), []),
    safely(() => usage(), { sessionMinutes: 0, dayMinutes: 0 }),
    safely(() => limits(), { sessionCapMinutes: 40, dayCapMinutes: 80, killSwitch: false }),
  ])

  const catches = entries.filter((entry) => entry.kind === "catch")
  const byVoyage = new Map(progress.map((row) => [row.voyageSlug, row]))
  const peak = Math.max(1, ...byDay.map((row) => row.catches))

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">Kapitäns-Deck</p>
        <h1>{catches.length} Fänge insgesamt</h1>

        <section className="panel">
          <p className="chartlabel">Fänge pro Tag</p>
          {byDay.length === 0 ? (
            <p className="muted">Noch nichts gefangen.</p>
          ) : (
            <table>
              <tbody>
                {byDay.map((row) => (
                  <tr key={row.day}>
                    <td style={{ width: "8rem" }}>{row.day}</td>
                    <td>
                      {/* A bar made of characters. A chart library for one
                          series of integers would be a dependency to justify
                          on a page one person reads. */}
                      <span style={{ color: "var(--color-brass)" }}>
                        {"█".repeat(Math.round((row.catches / peak) * 20))}
                      </span>{" "}
                      {row.catches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted">
            Die Zahl, auf die es ankommt: steigt sie über sechs Wochen. Ziel ist ≥3 pro Sitzung ab
            Woche 4.
          </p>
        </section>

        <section className="panel">
          <p className="chartlabel">Fortschritt</p>
          <table>
            <thead>
              <tr>
                <th>Fahrt</th>
                <th>Stand</th>
                <th>Worüber reden</th>
              </tr>
            </thead>
            <tbody>
              {voyages().map((voyage) => {
                const row = byVoyage.get(voyage.slug)
                return (
                  <tr key={voyage.slug}>
                    <td>
                      {voyage.id}. {voyage.title}
                      {voyage.twoSeater ? <span className="two-seater"> · zu zweit</span> : null}
                    </td>
                    <td>
                      {row?.completedAt
                        ? `fertig ${row.completedAt.toLocaleDateString("de-DE")}`
                        : row
                          ? "unterwegs"
                          : "offen"}
                    </td>
                    <td className="muted">{voyage.debrief.parentNote}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <p className="chartlabel">Transkripte</p>
          {runs.length === 0 ? (
            <p className="muted">Noch keine Sitzungen.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Wann</th>
                  <th>Station</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.startedAt.toLocaleString("de-DE")}</td>
                    <td>
                      {voyageBySlug(run.voyageSlug)?.title ?? run.voyageSlug} · {run.stationId}
                    </td>
                    <td>
                      <Link href={`/deck/transkript/${run.id}`}>lesen</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <p className="chartlabel">Eskalationen</p>
          <p className="muted">
            Jede Zeile ist ein Moment, in dem die freien Modelle nichts Brauchbares geliefert haben
            und ein bezahltes eingesprungen ist. Das ist die einzige Stelle, an der laufende Kosten
            entstehen.
          </p>
          {escalated.length === 0 ? (
            <p className="muted">Keine. Bisher lief alles auf freien Modellen.</p>
          ) : (
            <table>
              <tbody>
                {escalated.map((row) => (
                  <tr key={row.id}>
                    <td>{row.at.toLocaleString("de-DE")}</td>
                    <td>{row.station}</td>
                    <td className="muted">
                      {row.fromModel} → {row.toModel}
                    </td>
                    <td className="muted">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <p className="chartlabel">Zeit und Schalter</p>
          <p className="muted">
            Gerade benutzt: {Math.round(used.sessionMinutes)} min in dieser Sitzung,{" "}
            {Math.round(used.dayMinutes)} min in 24 Stunden.
          </p>
          <form action={saveSettingsAction}>
            <div className="split">
              <div>
                <label htmlFor="sessionCap">Sitzung höchstens (Minuten)</label>
                <input
                  id="sessionCap"
                  name="sessionCap"
                  type="number"
                  min="5"
                  max="120"
                  defaultValue={config.sessionCapMinutes}
                />
              </div>
              <div>
                <label htmlFor="dayCap">Pro Tag höchstens (Minuten)</label>
                <input
                  id="dayCap"
                  name="dayCap"
                  type="number"
                  min="5"
                  max="240"
                  defaultValue={config.dayCapMinutes}
                />
              </div>
            </div>
            <p style={{ marginTop: "var(--space-4)" }}>
              <label htmlFor="killSwitch">
                <input
                  id="killSwitch"
                  name="killSwitch"
                  type="checkbox"
                  defaultChecked={config.killSwitch}
                  style={{ width: "auto", marginRight: "var(--space-2)" }}
                />
                Segel geschlossen halten
              </label>
            </p>
            <button type="submit">Speichern</button>
          </form>
        </section>

        <section className="panel">
          <p className="chartlabel">Logbuch, vollständig</p>
          {entries.length === 0 ? (
            <p className="muted">Leer.</p>
          ) : (
            <table>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ width: "9rem" }}>{entry.at.toLocaleDateString("de-DE")}</td>
                    <td style={{ width: "6rem" }}>{entry.kind}</td>
                    <td>
                      {entry.title}
                      {entry.quote ? <div className="muted">„{entry.quote}“</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <form action={lockAction}>
          <button type="submit" className="quiet">
            Deck wieder abschließen
          </button>
        </form>

        <form action={signOutAction} style={{ marginTop: "var(--space-4)" }}>
          <button type="submit" className="quiet">
            Abmelden
          </button>
        </form>
      </main>
    </>
  )
}

function Locked() {
  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">Kapitäns-Deck</p>
        <h1>Abgeschlossen</h1>
        <p className="lead muted">
          Hier stehen alle Transkripte, der Fortschritt und die Zeitgrenzen. Zum Öffnen noch einmal
          das Passwort.
        </p>
        <form action={unlockAction} className="panel">
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <p style={{ marginTop: "var(--space-4)" }}>
            <button type="submit">Aufschließen</button>
          </p>
        </form>
        <p>
          <Link href="/">Zurück zum Logbuch</Link>
        </p>
      </main>
    </>
  )
}
