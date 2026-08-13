"use client"

import { useState } from "react"
import type { Station } from "@/segel/content-schema"

type QuizContent = Extract<Station, { type: "quiz" }>

/**
 * The quiz, graded in the browser.
 *
 * The answers are in the content JSON, so grading is a comparison rather than
 * a model call: instant, free, and never wrong. Asking a small free model to
 * mark multiple choice would be slower, cost tokens, and occasionally mark a
 * correct answer wrong — in an app about models being confidently wrong,
 * that would be an unusually poor joke.
 */
export function QuizStation({ voyageId, station }: { voyageId: string; station: QuizContent }) {
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [done, setDone] = useState(false)

  const answered = station.questions.filter((question) => question.id in picked).length
  const right = station.questions.filter(
    (question) => picked[question.id] === question.answer,
  ).length

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
      {station.questions.map((question) => {
        const choice = picked[question.id]
        const shown = choice !== undefined
        return (
          <div className="card" key={question.id}>
            <h3>{question.question}</h3>
            <div className="stack">
              {question.options.map((option, index) => {
                const isChoice = choice === index
                const isAnswer = index === question.answer
                const className = !shown
                  ? "chip"
                  : isAnswer
                    ? "chip verdict-right"
                    : isChoice
                      ? "chip verdict-wrong"
                      : "chip"
                return (
                  <button
                    type="button"
                    className={className}
                    key={option}
                    aria-pressed={isChoice}
                    disabled={shown}
                    onClick={() => setPicked((current) => ({ ...current, [question.id]: index }))}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {shown ? (
              <p className="muted" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
                {question.why}
              </p>
            ) : null}
          </div>
        )
      })}

      {answered === station.questions.length && !done ? (
        <div>
          <button type="button" onClick={finish}>
            Fertig — {right} von {station.questions.length}
          </button>
        </div>
      ) : null}

      {done ? (
        <p className="muted">
          {right} von {station.questions.length} richtig. Eingetragen.
        </p>
      ) : null}
    </div>
  )
}
