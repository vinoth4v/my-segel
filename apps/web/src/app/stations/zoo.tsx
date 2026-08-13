"use client"

import { useState } from "react"
import type { Station } from "@/segel/content-schema"

type ZooStationContent = Extract<Station, { type: "zoo" }>

type Answer = { letter: string; text: string; failed: boolean }
type Revealed = {
  place: number
  letter: string
  name: string
  origin: string
  size: string
  servedBy: string
}

/**
 * Der Modell-Zoo: one question, three models, A/B/C, blind.
 *
 * The order of operations is the lesson. She reads, she ranks, she writes
 * why — and only then do the names appear. The browser genuinely does not
 * know which model is which until it posts the ranking, so there is nothing
 * to peek at.
 */
export function ZooStation({
  voyageId,
  station,
}: {
  voyageId: string
  station: ZooStationContent
}) {
  const [question, setQuestion] = useState(station.question)
  const [round, setRound] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [ranking, setRanking] = useState<string[]>([])
  const [why, setWhy] = useState("")
  const [revealed, setRevealed] = useState<Revealed[]>([])
  /** False when the round happened to be served by one model under three letters. */
  const [honest, setHonest] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  async function run() {
    setBusy(true)
    setNotice("")
    setAnswers([])
    setRanking([])
    setRevealed([])

    try {
      const response = await fetch("/api/station/zoo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voyageId, stationId: station.id, question, round }),
      })
      const data = (await response.json()) as {
        answers?: Answer[]
        message?: string
        refused?: string
        stopped?: string
      }

      if (data.refused || data.stopped) {
        setNotice(data.message ?? "Das geht so nicht.")
        return
      }
      setAnswers(data.answers ?? [])
    } catch {
      setNotice("Die Verbindung hat nicht geklappt.")
    } finally {
      setBusy(false)
    }
  }

  function toggle(letter: string) {
    setRanking((current) =>
      current.includes(letter) ? current.filter((entry) => entry !== letter) : [...current, letter],
    )
  }

  async function reveal() {
    const response = await fetch("/api/station/zoo/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voyageId, stationId: station.id, round, ranking, why }),
    })
    const data = (await response.json()) as {
      revealed?: Revealed[]
      honest?: boolean
      error?: string
    }
    if (data.revealed) {
      setRevealed(data.revealed)
      setHonest(data.honest !== false)
    } else {
      setNotice(data.error ?? "Das hat nicht geklappt.")
    }
  }

  const arrived = answers.filter((answer) => !answer.failed)
  const canReveal = ranking.length === arrived.length && arrived.length > 0 && why.trim().length > 0

  return (
    <div className="stack">
      <label htmlFor="zoo-frage">Die Frage, die alle drei bekommen</label>
      <textarea
        id="zoo-frage"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        disabled={revealed.length > 0}
      />

      {station.seeds.length > 0 && answers.length === 0 ? (
        <div className="chips">
          {station.seeds.map((seed) => (
            <button
              type="button"
              className="chip"
              key={seed.label}
              onClick={() => setQuestion(seed.prompt)}
            >
              {seed.label}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <button type="button" onClick={run} disabled={busy || !question.trim()}>
          {busy
            ? "Drei Modelle denken nach…"
            : answers.length
              ? "Noch mal, andere drei"
              : "Alle drei fragen"}
        </button>
      </div>

      {notice ? <p role="alert">{notice}</p> : null}

      {answers.length > 0 ? (
        <>
          <div className="trio">
            {answers.map((answer) => {
              const place = ranking.indexOf(answer.letter)
              const identity = revealed.find((entry) => entry.letter === answer.letter)
              return (
                <div className="card" key={answer.letter}>
                  <span className="turn-who">
                    {identity ? `${answer.letter} — ${identity.name}` : answer.letter}
                  </span>
                  {answer.failed ? (
                    <p className="muted">
                      Keine Antwort. Das passiert bei freien Modellen — sie sind manchmal
                      überlastet.
                    </p>
                  ) : (
                    <p style={{ whiteSpace: "pre-wrap" }}>{answer.text}</p>
                  )}

                  {identity ? (
                    <p className="muted" style={{ marginBottom: 0 }}>
                      Platz {identity.place} bei dir · {identity.origin} · {identity.size}
                    </p>
                  ) : answer.failed ? null : (
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={place >= 0}
                      onClick={() => toggle(answer.letter)}
                    >
                      {place >= 0 ? `Platz ${place + 1}` : "Hierhin einsortieren"}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {revealed.length === 0 ? (
            <>
              <p className="muted">
                Klick die Antworten in der Reihenfolge an, die du am besten findest — beste zuerst.
                Danach werden die Namen aufgedeckt.
              </p>
              <label htmlFor="zoo-warum">Warum steht deine erste an erster Stelle?</label>
              <input
                id="zoo-warum"
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                placeholder="Die war am kürzesten und ich habe sie sofort verstanden"
              />
              <div>
                <button type="button" onClick={reveal} disabled={!canReveal}>
                  Aufdecken
                </button>
              </div>
            </>
          ) : (
            <div className="card">
              <h3>{honest ? "Jetzt weisst du, wer wer war" : "Diesmal war es nur eines"}</h3>
              {honest ? (
                <p>
                  Dieselbe Frage, drei verschiedene Antworten. Es gibt nicht <em>die</em> KI — es
                  gibt viele, und sie sind sich nicht einig.
                </p>
              ) : (
                // Better to admit a dud round than to name three models that
                // were secretly one. The whole station is about checking.
                <p>
                  Diesmal hat dieselbe Maschine alle drei Antworten geschrieben — die anderen waren
                  gerade belegt. Deshalb klingen sie so ähnlich. Probier noch eine Runde.
                </p>
              )}
              <button
                type="button"
                className="quiet"
                onClick={() => {
                  setRound(round + 1)
                  setRevealed([])
                  setAnswers([])
                  setRanking([])
                  setWhy("")
                }}
              >
                Noch eine Runde mit anderen Modellen
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
