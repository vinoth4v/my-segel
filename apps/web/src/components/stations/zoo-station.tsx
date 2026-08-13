"use client"

import { useState } from "react"
import { fileEntry } from "@/app/fahrt/[slug]/[station]/actions"
import type { ZooStation as ZooStationContent } from "@/content/schema"

type Answer = { label: string; text: string | null; failed: boolean }
type Reveal = { label: string; servedBy: string }

/**
 * Der Modell-Zoo. One prompt, three models, blind.
 *
 * The station's whole value is the order of operations: read, rank, say why,
 * *then* see the names. So the reveal is gated behind her having written a
 * reason — not behind a timer or a click, because a click is free and a
 * sentence is not.
 *
 * A column that timed out is shown as a column that timed out, rather than
 * hidden. "One of them did not answer in time" is a true and useful thing to
 * learn about models, and quietly rendering two columns where three were
 * promised would teach her that the app is unreliable instead.
 */
export function ZooStation({
  runId,
  voyageSlug,
  station,
}: {
  runId: string
  voyageSlug: string
  station: ZooStationContent
}) {
  const [answers, setAnswers] = useState<Answer[] | null>(null)
  const [reveal, setReveal] = useState<Reveal[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [best, setBest] = useState("")
  const [why, setWhy] = useState("")
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  async function run(prompt: string) {
    if (busy || !prompt.trim()) return
    setBusy(true)
    setHeld(null)
    setAnswers(null)
    setRevealed(false)
    setBest("")
    setWhy("")

    try {
      const response = await fetch("/api/station/zoo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, prompt: prompt.trim() }),
      })
      const result = await response.json()

      if (result.kind === "answers") {
        setAnswers(result.answers)
        setReveal(result.reveal)
      } else {
        setHeld(result.message ?? "Das hat nicht geklappt.")
      }
    } catch {
      setHeld("Die Verbindung ist weg. Versuch es nochmal.")
    } finally {
      setBusy(false)
    }
  }

  async function submitRanking() {
    if (!best || !why.trim()) return
    await fileEntry({
      kind: "ranking",
      voyageSlug,
      stationId: station.id,
      runId,
      title: `${best} war am besten`,
      detail: why.trim(),
    })
    setRevealed(true)
  }

  const servedByLabel = (label: string) =>
    reveal?.find((entry) => entry.label === label)?.servedBy || "unbekannt"

  return (
    <>
      {held ? <p role="alert">{held}</p> : null}

      {!answers ? (
        <>
          <div className="chips">
            {station.prompts.map((prompt) => (
              <button type="button" key={prompt} onClick={() => run(prompt)} disabled={busy}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(draft)
            }}
          >
            <label htmlFor="zoo-input">Oder deine eigene Frage</label>
            <textarea
              id="zoo-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
            />
            <p>
              <button type="submit" disabled={busy || !draft.trim()}>
                {busy ? "Drei Modelle antworten" : "An alle drei schicken"}
              </button>
            </p>
          </form>
        </>
      ) : (
        <>
          <div className="trio">
            {answers.map((answer) => (
              <div className="panel" key={answer.label}>
                <p className="chartlabel">
                  {answer.label}
                  {revealed ? ` · ${servedByLabel(answer.label)}` : ""}
                </p>
                {answer.failed ? (
                  <p className="muted">
                    Keine Antwort in acht Sekunden. Auch das ist ein Ergebnis.
                  </p>
                ) : (
                  <p style={{ whiteSpace: "pre-wrap" }}>{answer.text}</p>
                )}
              </div>
            ))}
          </div>

          {revealed ? (
            <div className="panel">
              <p className="chartlabel">Aufgedeckt</p>
              <p>{station.revealNote}</p>
              <p>
                <button type="button" className="quiet" onClick={() => setAnswers(null)}>
                  Nochmal, andere Frage
                </button>
              </p>
            </div>
          ) : (
            <div className="panel">
              <p className="chartlabel">Sortieren</p>
              <p>Welche Antwort war die beste — und warum? Danach siehst du die Namen.</p>
              <div className="chips">
                {answers.map((answer) => (
                  <button
                    type="button"
                    key={answer.label}
                    onClick={() => setBest(answer.label)}
                    style={
                      best === answer.label ? { borderColor: "var(--color-accent)" } : undefined
                    }
                  >
                    {answer.label} war am besten
                  </button>
                ))}
              </div>
              <label htmlFor="zoo-why">Warum?</label>
              <input
                id="zoo-why"
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                placeholder="Ein Satz reicht"
              />
              <p style={{ marginTop: "var(--space-3)" }}>
                <button type="button" onClick={() => void submitRanking()} disabled={!best || !why.trim()}>
                  Namen aufdecken
                </button>
              </p>
            </div>
          )}
        </>
      )}
    </>
  )
}
