"use client"

import { useState } from "react"
import { fileEntry } from "@/app/fahrt/[slug]/[station]/actions"
import type { QuizStation as QuizStationContent } from "@/content/schema"

/**
 * The check.
 *
 * Graded in the browser against answers that ship in the content, with no
 * model call at all. The spec routes grading to a small free model; for a
 * multiple-choice question whose answer is a number in a JSON file, calling a
 * model would be slower, less reliable and would spend tokens to reproduce a
 * comparison. The model-graded path is worth keeping for free-text answers,
 * which this station does not have.
 *
 * The "why" is shown for every answer, right or wrong. Being right for the
 * wrong reason is the failure mode this whole curriculum is about.
 */
export function QuizStation({
  runId,
  voyageSlug,
  station,
}: {
  runId: string
  voyageSlug: string
  station: QuizStationContent
}) {
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [right, setRight] = useState(0)

  async function next() {
    if (index + 1 < station.questions.length) {
      setIndex(index + 1)
      setChosen(null)
      return
    }

    await fileEntry({
      kind: "quiz",
      voyageSlug,
      stationId: station.id,
      runId,
      title: `${station.title}: ${right} von ${station.questions.length}`,
    })
    setIndex(station.questions.length)
  }

  // Before the lookup: at the end `index` is one past the last question, and
  // reading questions[index] there would render nothing at all.
  if (index >= station.questions.length) {
    return (
      <div className="panel">
        <p className="chartlabel">Durch</p>
        <p>
          {right} von {station.questions.length} richtig.
        </p>
      </div>
    )
  }

  const question = station.questions[index]
  if (!question) return null

  const answered = chosen !== null
  const correct = answered && chosen === question.answerIndex

  return (
    <div className="panel">
      <p className="chartlabel">
        Frage {index + 1} von {station.questions.length}
      </p>
      <h3>{question.q}</h3>

      <div className="chips" style={{ flexDirection: "column" }}>
        {question.options.map((option, position) => (
          <button
            type="button"
            key={option}
            disabled={answered}
            onClick={() => {
              setChosen(position)
              if (position === question.answerIndex) setRight((previous) => previous + 1)
            }}
            style={
              answered && position === question.answerIndex
                ? { borderColor: "var(--color-seaglass)" }
                : answered && position === chosen
                  ? { borderColor: "var(--color-danger)" }
                  : undefined
            }
          >
            {option}
          </button>
        ))}
      </div>

      {answered ? (
        <>
          <p className="row">
            {correct ? (
              <span className="stamp landing">Richtig</span>
            ) : (
              <span className="muted">Nicht ganz.</span>
            )}
          </p>
          <p>{question.why}</p>
          <button type="button" onClick={() => void next()}>
            {index + 1 < station.questions.length ? "Weiter" : "Fertig"}
          </button>
        </>
      ) : null}
    </div>
  )
}
