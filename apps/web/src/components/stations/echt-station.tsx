"use client"

import { useState } from "react"
import { fileEntry } from "@/app/fahrt/[slug]/[station]/actions"
import { PlateArt } from "@/components/plate-art"
import type { EchtStation as EchtStationContent } from "@/content/schema"
import { platesFor } from "@/lib/plates"

/**
 * Echt oder Fake?
 *
 * One plate at a time, answer first, tells after. Showing all six at once
 * would let her compare them against each other and win without looking at any
 * of them properly — which is the opposite of the habit this station is for.
 *
 * She is never told her score as a percentage. What she takes away is the list
 * of places to look, and a number would replace that with a number.
 */
export function EchtStation({
  runId,
  voyageSlug,
  station,
}: {
  runId: string
  voyageSlug: string
  station: EchtStationContent
}) {
  const plates = platesFor(station.plateIds)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<boolean | null>(null)
  const [right, setRight] = useState(0)

  async function next(plateCount: number) {
    if (index + 1 < plateCount) {
      setIndex(index + 1)
      setAnswer(null)
      return
    }

    await fileEntry({
      kind: "echt",
      voyageSlug,
      stationId: station.id,
      runId,
      title: `Bilder geprüft: ${right} von ${plateCount} richtig`,
      detail: "Hände, Schrift, Physik, Licht, Zählen.",
    })
    setIndex(plateCount)
  }

  // Checked before the lookup below: at the end, `index` is deliberately one
  // past the last plate, and reading plates[index] there would render the
  // "images are missing" fallback instead of the summary.
  if (plates.length > 0 && index >= plates.length) {
    return (
      <div className="panel">
        <p className="chartlabel">Durch</p>
        <p>
          {right} von {plates.length} richtig. Die Zahl ist nicht der Punkt — die fünf Stellen sind
          es: Hände, Schrift, Physik, Licht, Zählen.
        </p>
        <p>Heute Abend, in deinem echten Feed: schau nach denselben fünf Stellen.</p>
      </div>
    )
  }

  const plate = plates[index]
  if (!plate) return <p className="muted">Für diese Station fehlen die Bilder.</p>

  const answered = answer !== null
  const correct = answered && answer === plate.flawed

  function decide(saysFlawed: boolean, isFlawed: boolean) {
    setAnswer(saysFlawed)
    if (saysFlawed === isFlawed) setRight((previous) => previous + 1)
  }

  return (
    <>
      <p className="chartlabel">
        Bild {index + 1} von {plates.length}
      </p>

      <div className="panel">
        <div className="plate">
          <PlateArt id={plate.id} label={plate.alt} />
          {answered
            ? plate.tells.map((tell) => (
                <span
                  className="tell"
                  key={tell.label}
                  style={{ left: `${tell.x}%`, top: `${tell.y}%` }}
                >
                  {tell.label}
                </span>
              ))
            : null}
        </div>

        {!answered ? (
          <p className="row" style={{ marginTop: "var(--space-4)" }}>
            <button type="button" onClick={() => decide(false, plate.flawed)}>
              Hier stimmt alles
            </button>
            <button type="button" onClick={() => decide(true, plate.flawed)}>
              Da stimmt was nicht
            </button>
          </p>
        ) : (
          <div style={{ marginTop: "var(--space-4)" }}>
            <p className="row">
              {correct ? (
                <span className="stamp landing">Richtig</span>
              ) : (
                <span className="muted">Daneben — und genau da lernt man am meisten.</span>
              )}
            </p>
            <p>{plate.lesson}</p>
            <button type="button" onClick={() => void next(plates.length)}>
              {index + 1 < plates.length ? "Nächstes Bild" : "Fertig"}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
