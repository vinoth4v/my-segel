"use client"

import { useState } from "react"
import { fileCatch } from "@/app/fahrt/[slug]/[station]/actions"
import type { JagdStation as JagdStationContent } from "@/content/schema"

type Exchange = {
  question: string
  answer: string
  held: boolean
  caught: boolean
}

/**
 * Die Jagd. The core week, and the only station with a button that matters.
 *
 * Two decisions worth defending:
 *
 * The catch button sits under **every** answer from the moment the first one
 * arrives, not behind a "did you spot anything?" prompt. Asking her whether
 * she noticed something is telling her there is something to notice, which
 * turns an unprompted catch into a prompted one — and unprompted catches are
 * the metric the whole six weeks is measured on.
 *
 * The "warum?" field is required before the stamp lands. A catch without a
 * reason is a button press; the reason is where the thinking happens, and it
 * is what makes the Logbuch re-readable in six weeks.
 */
export function JagdStation({
  runId,
  voyageSlug,
  station,
}: {
  runId: string
  voyageSlug: string
  station: JagdStationContent
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [catching, setCatching] = useState<number | null>(null)
  const [why, setWhy] = useState("")
  const [justStamped, setJustStamped] = useState(false)

  async function hunt(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setBusy(true)
    setDraft("")

    try {
      const response = await fetch("/api/station/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, text: trimmed }),
      })
      const result = await response.json()

      setExchanges((previous) => [
        ...previous,
        {
          question: trimmed,
          answer: result.kind === "answer" ? result.reply : result.message,
          held: result.kind !== "answer",
          caught: false,
        },
      ])
    } catch {
      setExchanges((previous) => [
        ...previous,
        {
          question: trimmed,
          answer: "Die Verbindung ist weg. Versuch es nochmal.",
          held: true,
          caught: false,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function stamp(index: number) {
    const exchange = exchanges[index]
    if (!exchange || !why.trim()) return

    await fileCatch({
      voyageSlug,
      stationId: station.id,
      runId,
      quote: exchange.answer,
      why: why.trim(),
    })

    setExchanges((previous) =>
      previous.map((item, position) => (position === index ? { ...item, caught: true } : item)),
    )
    setCatching(null)
    setWhy("")
    setJustStamped(true)
  }

  const caught = exchanges.filter((exchange) => exchange.caught).length

  return (
    <>
      <p className="row">
        <span className="chartlabel">Gefangen in dieser Runde</span>
        {caught === 0 ? (
          <span className="muted">noch keine</span>
        ) : (
          <span className={justStamped ? "stamp landing" : "stamp"}>
            {caught} {caught === 1 ? "Fang" : "Fänge"}
          </span>
        )}
      </p>

      <div className="chips">
        {station.targets.map((target) =>
          target.prompt ? (
            <button
              type="button"
              key={target.label}
              onClick={() => hunt(target.prompt)}
              disabled={busy}
            >
              {target.label}
            </button>
          ) : (
            // The open target: she knows what she is expert in and nobody else
            // can write this bait for her, so it fills the box instead of firing.
            <button
              type="button"
              key={target.label}
              onClick={() => setDraft("Erzähl mir alles über ")}
              disabled={busy}
            >
              {target.label}
            </button>
          ),
        )}
      </div>

      {exchanges.map((exchange, index) => (
        <div className="panel" key={`${index}-${exchange.question.slice(0, 12)}`}>
          <div className="turn" data-role="segler">
            <span className="turn-who">Du</span>
            {exchange.question}
          </div>
          <div
            className="turn"
            data-role="schiff"
            data-blocked={exchange.held ? "true" : "false"}
            style={{ marginTop: "var(--space-3)" }}
          >
            <span className="turn-who">Schwaches Modell</span>
            {exchange.answer}
          </div>

          {exchange.caught ? (
            <p className="row" style={{ marginTop: "var(--space-4)" }}>
              <span className="stamp landing">Gefangen</span>
              <span className="muted">Steht im Logbuch.</span>
            </p>
          ) : exchange.held ? null : catching === index ? (
            <div style={{ marginTop: "var(--space-4)" }}>
              <label htmlFor={`why-${index}`}>Was stimmt daran nicht?</label>
              <input
                id={`why-${index}`}
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                placeholder="Ein Satz reicht"
              />
              <p className="row" style={{ marginTop: "var(--space-3)" }}>
                <button type="button" onClick={() => void stamp(index)} disabled={!why.trim()}>
                  Ab ins Logbuch
                </button>
                <button type="button" className="quiet" onClick={() => setCatching(null)}>
                  Doch nicht
                </button>
              </p>
            </div>
          ) : (
            <p style={{ marginTop: "var(--space-4)" }}>
              <button
                type="button"
                className="catch"
                onClick={() => {
                  setCatching(index)
                  setWhy("")
                  setJustStamped(false)
                }}
              >
                Das stimmt nicht
              </button>
            </p>
          )}
        </div>
      ))}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void hunt(draft)
        }}
      >
        <label htmlFor="jagd-input">Eigene Frage</label>
        <textarea
          id="jagd-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Frag nach etwas, wo du dich richtig gut auskennst"
          rows={3}
        />
        <p>
          <button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Antwortet" : "Fragen"}
          </button>
        </p>
      </form>
    </>
  )
}
