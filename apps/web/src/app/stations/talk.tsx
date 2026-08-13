"use client"

import { useState } from "react"
import type { Station } from "@/segel/content-schema"

type TalkOrJagd = Extract<Station, { type: "talk" } | { type: "jagd" }>

type Turn = {
  /** Its own identity, so React tracks a turn rather than a position. */
  id: number
  who: "kind" | "modell"
  text: string
  /** Which model answered. Shown on Die Jagd — the thing that was wrong has a name. */
  model?: string
  caught?: boolean
}

let nextTurnId = 0

/**
 * Gespräch and Die Jagd.
 *
 * The same conversation surface, with one difference that carries the whole
 * second week: on Die Jagd every reply gets a [Das stimmt nicht] button, and
 * pressing it asks her *why* before it files anything. The "why" is not
 * optional and not a free-text nicety — a rising count of catches with no
 * reasons would look like progress and teach nothing.
 */
export function TalkStation({ voyageId, station }: { voyageId: string; station: TalkOrJagd }) {
  const hunting = station.type === "jagd"
  const target = hunting ? station.targetCatches : 0

  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [catches, setCatches] = useState(0)
  const [asking, setAsking] = useState<number | undefined>(undefined)
  const [why, setWhy] = useState("")
  const [justStamped, setJustStamped] = useState(false)

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return

    const history: Turn[] = [...turns, { id: nextTurnId++, who: "kind", text: question }]
    setTurns(history)
    setDraft("")
    setBusy(true)
    setNotice("")

    try {
      const response = await fetch("/api/station/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voyageId,
          stationId: station.id,
          messages: history.map((turn) => ({
            role: turn.who === "kind" ? "user" : "assistant",
            content: turn.text,
          })),
        }),
      })
      const data = (await response.json()) as {
        text?: string
        message?: string
        model?: string
        refused?: string
        stopped?: string
      }

      if (data.refused || data.stopped) {
        // Her message never left the server. Drop it from the thread so she
        // can edit and resend rather than seeing it sit there rejected.
        setTurns(turns)
        setDraft(question)
        setNotice(data.message ?? "Das geht so nicht.")
        return
      }

      if (data.text) {
        setTurns([
          ...history,
          {
            id: nextTurnId++,
            who: "modell",
            text: data.text,
            ...(data.model ? { model: data.model } : {}),
          },
        ])
      } else {
        setNotice(data.message ?? "Keine Antwort. Versuch es noch einmal.")
      }
    } catch {
      setNotice("Die Verbindung hat nicht geklappt. Versuch es noch einmal.")
    } finally {
      setBusy(false)
    }
  }

  async function fileCatch(index: number) {
    const said = turns[index]
    const asked = turns[index - 1]
    if (!said || !why.trim()) return

    const response = await fetch("/api/logbuch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voyageId,
        stationId: station.id,
        kind: "catch",
        title: asked?.text.slice(0, 120) ?? "Fehler gefangen",
        detail: said.text,
        why,
      }),
    })
    const data = (await response.json()) as { filed?: boolean; score?: number; message?: string }

    if (!data.filed) {
      setNotice(data.message ?? "Das konnte ich nicht eintragen.")
      return
    }

    setTurns(turns.map((turn, at) => (at === index ? { ...turn, caught: true } : turn)))
    setCatches(data.score ?? catches + 1)
    setAsking(undefined)
    setWhy("")
    setJustStamped(true)
  }

  return (
    <div className="stack">
      {hunting ? (
        <p className="row">
          <span className={`stamp${justStamped ? " landing" : ""}`} aria-hidden="true">
            {catches}
          </span>
          <span className="muted">
            {catches >= target
              ? "Genug gefangen für heute. Du kannst weiterjagen, wenn du willst."
              : `${catches} von ${target} Fehlern gefangen.`}
          </span>
        </p>
      ) : null}

      {turns.map((turn, index) => (
        <div
          key={turn.id}
          className={`turn ${turn.who === "kind" ? "kind" : ""} ${turn.caught ? "caught" : ""}`}
        >
          <span className="turn-who">{turn.who === "kind" ? "Du" : (turn.model ?? "Modell")}</span>
          {turn.text}

          {hunting && turn.who === "modell" && !turn.caught ? (
            asking === index ? (
              <div className="stack" style={{ marginTop: "var(--space-4)" }}>
                <label htmlFor={`why-${index}`}>Woran hast du gemerkt, dass das falsch ist?</label>
                <input
                  id={`why-${index}`}
                  value={why}
                  onChange={(event) => setWhy(event.target.value)}
                  placeholder="Den Otter gibt es gar nicht — den habe ich erfunden"
                />
                <div className="row">
                  <button type="button" onClick={() => fileCatch(index)} disabled={!why.trim()}>
                    Eintragen
                  </button>
                  <button type="button" className="quiet" onClick={() => setAsking(undefined)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "var(--space-4)" }}>
                <button
                  type="button"
                  className="catch"
                  onClick={() => {
                    setAsking(index)
                    setWhy("")
                    setJustStamped(false)
                  }}
                >
                  Das stimmt nicht
                </button>
              </div>
            )
          ) : null}

          {turn.caught ? (
            <p className="muted" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
              Im Logbuch eingetragen.
            </p>
          ) : null}
        </div>
      ))}

      {notice ? <p role="alert">{notice}</p> : null}

      {station.seeds.length > 0 ? (
        <div className="chips">
          {station.seeds.map((seed) => (
            <button
              type="button"
              className="chip"
              key={seed.label}
              onClick={() => send(seed.prompt)}
              disabled={busy}
            >
              {seed.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          send(draft)
        }}
      >
        <label htmlFor="frage">Deine Frage</label>
        <textarea
          id="frage"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Schreib hier"
        />
        <div>
          <button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Das Modell überlegt…" : "Abschicken"}
          </button>
        </div>
      </form>
    </div>
  )
}
