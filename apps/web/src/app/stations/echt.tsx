"use client"

import { useState } from "react"
import { Scene } from "@/app/stations/scenes"
import type { Station } from "@/segel/content-schema"

type EchtContent = Extract<Station, { type: "echt" }>

/**
 * Echt oder Fake?
 *
 * She decides first, then the tell appears. Reversing that order — showing
 * the tells alongside the pictures — would turn the station into reading
 * comprehension. The point is the moment of committing to a guess and then
 * finding out, because that is the moment that transfers to her feed.
 */
export function EchtStation({ voyageId, station }: { voyageId: string; station: EchtContent }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState(false)

  const answered = station.items.filter((item) => item.id in picked).length
  const right = station.items.filter((item) => picked[item.id] === item.fake).length

  async function finish() {
    setDone(true)
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voyageId, stationId: station.id, action: "complete", score: right }),
    })
  }

  return (
    <div className="stack">
      <div className="split">
        {station.items.map((item) => {
          const guess = picked[item.id]
          const shown = guess !== undefined
          const correct = shown && guess === item.fake

          return (
            <div className="card" key={item.id}>
              <Scene name={item.scene} />
              <p className="muted" style={{ marginTop: "var(--space-3)" }}>
                {item.caption}
              </p>

              {shown ? (
                <>
                  <p className={correct ? "" : "muted"}>
                    <strong>
                      {item.fake ? "Erzeugt." : "Echt."} {correct ? "Richtig geraten." : "Daneben."}
                    </strong>
                  </p>
                  <p style={{ marginBottom: 0 }}>{item.tell}</p>
                </>
              ) : (
                <div className="chips">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setPicked((current) => ({ ...current, [item.id]: false }))}
                  >
                    Echt
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setPicked((current) => ({ ...current, [item.id]: true }))}
                  >
                    Erzeugt
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {answered === station.items.length && !done ? (
        <div>
          <button type="button" onClick={finish}>
            Fertig — {right} von {station.items.length}
          </button>
        </div>
      ) : null}

      {done ? (
        <div className="card">
          <h3>
            {right} von {station.items.length}
          </h3>
          <p style={{ marginBottom: 0 }}>
            Diese Bilder sind gezeichnet, mit absichtlich eingebauten Fehlern. Draussen sind die
            Fehler kleiner. Der zuverlässigste Test ist deshalb nicht das Hinschauen, sondern die
            Frage: wer hat das gepostet, und steht es noch woanders?
          </p>
        </div>
      ) : null}
    </div>
  )
}
