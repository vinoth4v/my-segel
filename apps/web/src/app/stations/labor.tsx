"use client"

import { useMemo, useState } from "react"
import type { Station } from "@/segel/content-schema"
import { promptStrength } from "@/segel/strength"

type LaborStationContent = Extract<Station, { type: "labor" }>

/**
 * Prompt-Labor: her draft on the left, the assembled version on the right.
 *
 * The strength meter runs entirely in the browser and is arithmetic, not a
 * model judgement — it counts whether the four levers are present. That is
 * worth saying out loud to her, and the debrief note does: not everything
 * that looks clever is a model.
 */
export function LaborStation({
  voyageId,
  station,
}: {
  voyageId: string
  station: LaborStationContent
}) {
  const [weak, setWeak] = useState(station.seeds[0]?.prompt ?? "")
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ left: string; right: string; model: string }>()
  const [changed, setChanged] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  const strong = useMemo(() => assemble(station, picked), [station, picked])
  const weakScore = promptStrength(weak)
  const strongScore = promptStrength(strong)

  async function run() {
    setBusy(true)
    setNotice("")
    try {
      const response = await fetch("/api/station/labor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voyageId, stationId: station.id, weak, strong }),
      })
      const data = (await response.json()) as {
        left?: string
        right?: string
        model?: string
        message?: string
        refused?: string
        stopped?: string
      }
      if (data.refused || data.stopped || !data.left) {
        setNotice(data.message ?? "Das hat nicht geklappt.")
        return
      }
      setResult({ left: data.left, right: data.right ?? "", model: data.model ?? "" })
    } catch {
      setNotice("Die Verbindung hat nicht geklappt.")
    } finally {
      setBusy(false)
    }
  }

  async function keep() {
    await fetch("/api/logbuch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voyageId,
        stationId: station.id,
        kind: "note",
        title: "Prompt verbessert",
        detail: `Vorher: ${weak}\n\nNachher: ${strong}`,
        why: changed,
      }),
    })
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voyageId, stationId: station.id, action: "complete" }),
    })
    setNotice("Im Logbuch eingetragen.")
  }

  return (
    <div className="stack">
      <p className="card">
        <strong>Aufgabe:</strong> {station.task}
      </p>

      <div className="split">
        <div className="stack">
          <label htmlFor="weak">Dein erster Versuch</label>
          <textarea id="weak" value={weak} onChange={(event) => setWeak(event.target.value)} />
          <Meter score={weakScore} />
        </div>

        <div className="stack">
          <span className="chart-label">Die stärkere Fassung</span>
          {station.levers.map((lever) => (
            <div key={lever.id}>
              <span className="muted">{lever.label}</span>
              <div className="chips">
                {lever.options.map((option) => (
                  <button
                    type="button"
                    className="chip"
                    key={option}
                    aria-pressed={picked[lever.id] === option}
                    onClick={() =>
                      setPicked((current) => ({
                        ...current,
                        [lever.id]: current[lever.id] === option ? "" : option,
                      }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="turn">{strong || "Wähl oben aus, dann baut sich der Prompt hier."}</div>
          <Meter score={strongScore} />
        </div>
      </div>

      <div>
        <button type="button" onClick={run} disabled={busy || !weak.trim() || !strong.trim()}>
          {busy ? "Beide laufen…" : "Beide laufen lassen"}
        </button>
      </div>

      {notice ? <p role="alert">{notice}</p> : null}

      {result ? (
        <>
          <div className="split">
            <div className="card">
              <span className="turn-who">Dein erster Versuch</span>
              <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{result.left}</p>
            </div>
            <div className="card">
              <span className="turn-who">Die stärkere Fassung</span>
              <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{result.right}</p>
            </div>
          </div>
          <p className="muted">
            Beide Antworten kommen vom selben Modell{result.model ? ` (${result.model})` : ""}. Der
            Unterschied kommt allein von deinen Wörtern.
          </p>

          <label htmlFor="changed">Was hast du geändert?</label>
          <input
            id="changed"
            value={changed}
            onChange={(event) => setChanged(event.target.value)}
            placeholder="Ich habe gesagt, wer antworten soll und wie lang"
          />
          <div>
            <button type="button" onClick={keep} disabled={!changed.trim()}>
              Ins Logbuch
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Meter({ score }: { score: { value: number; missing: string[] } }) {
  const level = score.value >= 0.75 ? "" : score.value >= 0.4 ? "middling" : "weak"
  return (
    <div>
      <div className={`meter ${level}`}>
        <span style={{ width: `${Math.round(score.value * 100)}%` }} />
      </div>
      <p className="muted" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
        {score.missing.length === 0
          ? "Alle vier Hebel drin."
          : `Fehlt noch: ${score.missing.join(", ")}.`}
      </p>
    </div>
  )
}

/** Builds the stronger prompt from the levers she picked. */
function assemble(station: LaborStationContent, picked: Record<string, string>): string {
  const who = picked.wer
  const what = picked.was
  const not = picked.nicht
  const length = picked.laenge

  const parts = [
    who ? `Antworte als ${who}.` : "",
    what ? `Erklär mir ${what}.` : station.task,
    not ? `Verwende ${not}.` : "",
    length ? `Schreib ${length}.` : "",
  ].filter(Boolean)

  return parts.join(" ")
}
