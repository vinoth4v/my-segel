"use client"

import { useState } from "react"
import type { TalkStation as TalkStationContent } from "@/content/schema"

type Turn = { who: "segler" | "schiff"; text: string; held?: boolean }

/**
 * Scoped conversation.
 *
 * The chips are the reason this station works at all. A ten-year-old in front
 * of an empty box types nothing, decides the app is boring, and leaves — so
 * the first screen is six questions worth asking, and typing her own is the
 * thing she graduates to rather than the thing she is asked to start with.
 */
export function TalkStation({
  runId,
  station,
}: {
  runId: string
  station: TalkStationContent
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setBusy(true)
    setDraft("")
    setTurns((previous) => [...previous, { who: "segler", text: trimmed }])

    try {
      const response = await fetch("/api/station/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, text: trimmed }),
      })
      const result = await response.json()

      setTurns((previous) => [
        ...previous,
        result.kind === "answer"
          ? { who: "schiff", text: result.reply }
          : { who: "schiff", text: result.message, held: true },
      ])
    } catch {
      setTurns((previous) => [
        ...previous,
        { who: "schiff", text: "Die Verbindung ist weg. Versuch es nochmal.", held: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {turns.length > 0 ? (
        <div className="turns">
          {turns.map((turn, index) => (
            <div
              // Turns are append-only and never reordered, so the index is a
              // stable identity here — two identical texts are two real turns.
              key={`${index}-${turn.who}`}
              className="turn"
              data-role={turn.who}
              data-blocked={turn.held ? "true" : "false"}
            >
              <span className="turn-who">{turn.who === "segler" ? "Du" : "Segel"}</span>
              {turn.text}
            </div>
          ))}
        </div>
      ) : null}

      {turns.length === 0 ? (
        <div className="chips">
          {station.chips.map((chip) => (
            <button type="button" key={chip} onClick={() => send(chip)} disabled={busy}>
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <label htmlFor="talk-input">Deine Frage</label>
        <textarea
          id="talk-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Schreib, was du wissen willst"
          rows={3}
        />
        <p>
          <button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Denkt nach" : "Fragen"}
          </button>
        </p>
      </form>
    </>
  )
}
