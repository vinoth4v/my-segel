"use client"

import { useState } from "react"

type Version = { version: number; prompt: string; html: string; escalated: boolean }

/**
 * The version scrubber.
 *
 * Same sandbox rule as the Werkstatt: `allow-scripts` and nothing else, so
 * her page runs but stays in an opaque origin with no access to this one.
 */
export function GalleryViewer({
  id,
  shown,
  current,
  versions,
}: {
  id: string
  shown: boolean
  current: number
  versions: Version[]
}) {
  const [at, setAt] = useState(() =>
    Math.max(
      0,
      versions.findIndex((v) => v.version === current),
    ),
  )
  const [isShown, setIsShown] = useState(shown)
  const [busy, setBusy] = useState(false)

  const version = versions[at]
  if (!version) return <p className="muted">Diese Fassung fehlt.</p>

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/artifact/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
  }

  return (
    <div className="stack">
      <iframe
        className="frame"
        title={`${version.version}. Fassung`}
        srcDoc={version.html}
        sandbox="allow-scripts"
      />

      <div className="row">
        <span className="chart-label">Fassungen</span>
        <div className="chips">
          {versions.map((entry, index) => (
            <button
              type="button"
              className="chip"
              key={entry.version}
              aria-pressed={index === at}
              onClick={() => setAt(index)}
            >
              {entry.version}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <span className="turn-who">Dein Satz zu dieser Fassung</span>
        <p style={{ marginBottom: 0 }}>„{version.prompt}“</p>
        {version.escalated ? (
          <p className="muted" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
            Für diese Fassung hat das erste Modell nicht gereicht.
          </p>
        ) : null}
      </div>

      <div className="row">
        <button
          type="button"
          className="quiet"
          disabled={busy || version.version === current}
          onClick={() => post({ setCurrent: version.version })}
        >
          Diese Fassung ist die richtige
        </button>
        <button
          type="button"
          className="quiet"
          disabled={busy}
          onClick={() => {
            setIsShown(!isShown)
            post({ shown: !isShown })
          }}
        >
          {isShown ? "Hergezeigt ✓" : "Ich habe es jemandem gezeigt"}
        </button>
      </div>
    </div>
  )
}
