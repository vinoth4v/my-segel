"use client"

import { useMemo, useState } from "react"
import type { LaborStation as LaborStationContent } from "@/content/schema"
import { assemblePrompt, type Lever, scorePrompt } from "@/lib/prompt-strength"

/**
 * Das Prompt-Labor.
 *
 * The meter scores her draft *before* it runs, and names one missing lever
 * rather than all of them — a list of four faults reads as a report card, and
 * one suggestion reads as a next move.
 *
 * Both sides are sent in one request so they run on one model. That constraint
 * lives on the server (see the route), but it is worth knowing here too: this
 * component must never grow a "run just the left side" button, because the
 * comparison is the station and half a comparison is nothing.
 */
export function LaborStation({
  runId,
  station,
}: {
  runId: string
  station: LaborStationContent
}) {
  const [draft, setDraft] = useState("")
  const [chosen, setChosen] = useState<Partial<Record<Lever, string>>>({})
  const [result, setResult] = useState<{ left: string | null; right: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState<string | null>(null)

  const score = useMemo(() => scorePrompt(draft), [draft])
  const assembled = useMemo(() => assemblePrompt(draft, chosen), [draft, chosen])

  async function run() {
    if (busy || !draft.trim()) return
    setBusy(true)
    setHeld(null)

    try {
      const response = await fetch("/api/station/labor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, draft: draft.trim(), assembled }),
      })
      const answer = await response.json()

      if (answer.kind === "answers") {
        setResult({ left: answer.left, right: answer.right })
      } else {
        setHeld(answer.message ?? "Das hat nicht geklappt.")
      }
    } catch {
      setHeld("Die Verbindung ist weg. Versuch es nochmal.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {held ? <p role="alert">{held}</p> : null}

      <div className="panel">
        <p className="chartlabel">Aufgabe</p>
        <p>{station.task}</p>
      </div>

      <div className="split">
        <div className="panel">
          <p className="chartlabel">Deine Frage</p>
          <textarea
            aria-label="Deine Frage"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="So, wie du sie normal stellen würdest"
          />
          <div className="meter" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} data-on={index < score.score ? "true" : "false"} />
            ))}
          </div>
          <p className="muted">{score.label}</p>
          {score.suggestion ? <p className="muted">{score.suggestion}</p> : null}
        </div>

        <div className="panel">
          <p className="chartlabel">Stärkere Version</p>
          {station.levers.map((lever) => (
            <div key={lever.id} style={{ marginBottom: "var(--space-4)" }}>
              <label htmlFor={`lever-${lever.id}`}>{lever.label}</label>
              <select
                id={`lever-${lever.id}`}
                value={chosen[lever.id as Lever] ?? ""}
                onChange={(event) =>
                  setChosen((previous) => ({
                    ...previous,
                    [lever.id as Lever]: event.target.value || undefined,
                  }))
                }
              >
                <option value="">— weglassen —</option>
                {lever.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ fontSize: "var(--font-size-base)" }}>
                {lever.hint}
              </p>
            </div>
          ))}
          <p className="chartlabel">Wird so verschickt</p>
          <p className="muted">{assembled || "—"}</p>
        </div>
      </div>

      <p>
        <button type="button" onClick={() => void run()} disabled={busy || !draft.trim()}>
          {busy ? "Beide laufen" : "Beide laufen lassen"}
        </button>
      </p>

      {result ? (
        <div className="split">
          <div className="panel">
            <p className="chartlabel">Antwort auf deine Frage</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{result.left ?? "Keine Antwort gekommen."}</p>
          </div>
          <div className="panel">
            <p className="chartlabel">Antwort auf die stärkere Version</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{result.right ?? "Keine Antwort gekommen."}</p>
          </div>
        </div>
      ) : null}

      {result ? (
        <p className="notice">
          Beide Antworten kommen vom selben Modell. Was sich unterscheidet, liegt an der Frage.
        </p>
      ) : null}
    </>
  )
}
