"use client"

import { useState } from "react"
import type { Station } from "@/segel/content-schema"

type WerkstattContent = Extract<Station, { type: "werkstatt" }>

type Version = { version: number; prompt: string; html: string }

/**
 * Werkstatt: she describes a thing, and the thing appears.
 *
 * The frame is `sandbox="allow-scripts"` *without* allow-same-origin, which
 * is the combination that matters: scripts run, so her creation works, but
 * the document is in an opaque origin and cannot reach this page, its
 * cookies, or the session. Adding allow-same-origin alongside allow-scripts
 * would silently undo the whole sandbox — it is the single easiest mistake
 * to make here, which is why it is written down rather than assumed.
 */
export function WerkstattStation({
  voyageId,
  station,
}: {
  voyageId: string
  station: WerkstattContent
}) {
  const [prompt, setPrompt] = useState("")
  const [artifactId, setArtifactId] = useState<string>()
  const [versions, setVersions] = useState<Version[]>([])
  const [showing, setShowing] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  const current = versions[showing]

  async function build() {
    const text = prompt.trim()
    if (!text) return

    setBusy(true)
    setNotice("")
    try {
      const response = await fetch("/api/station/werkstatt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voyageId,
          stationId: station.id,
          prompt: text,
          ...(artifactId ? { artifactId } : {}),
        }),
      })
      const data = (await response.json()) as {
        artifactId?: string
        version?: number
        html?: string
        message?: string
        refused?: string
        stopped?: string
        repaired?: number
      }

      if (data.refused || data.stopped || !data.html) {
        setNotice(data.message ?? "Das hat nicht geklappt.")
        return
      }

      if (data.artifactId) setArtifactId(data.artifactId)
      const next = [
        ...versions,
        { version: data.version ?? versions.length + 1, prompt: text, html: data.html },
      ]
      setVersions(next)
      setShowing(next.length - 1)
      setPrompt("")

      if (data.repaired) {
        // Told rather than hidden. That a free model needed two goes is a
        // true fact about free models, and this app's whole subject is what
        // these things actually do.
        setNotice(
          data.repaired === 1
            ? "Der erste Versuch war kaputt. Das Modell hat ihn selbst repariert."
            : `Das hat ${data.repaired} Anläufe gebraucht.`,
        )
      }
    } catch {
      setNotice("Die Verbindung hat nicht geklappt.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      {current ? (
        <>
          <iframe
            className="frame"
            title={`Dein Werkstück, Fassung ${current.version}`}
            srcDoc={current.html}
            sandbox="allow-scripts"
          />
          <div className="row">
            <span className="chart-label">Fassung {current.version}</span>
            {versions.length > 1 ? (
              <div className="chips">
                {versions.map((version, index) => (
                  <button
                    type="button"
                    className="chip"
                    key={version.version}
                    aria-pressed={index === showing}
                    onClick={() => setShowing(index)}
                  >
                    {version.version}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <p className="muted">„{current.prompt}“</p>
        </>
      ) : (
        <div className="card">
          <h3>Was soll entstehen?</h3>
          <p className="muted">
            Beschreib es in einem oder zwei Sätzen. Danach kannst du sagen, was anders werden soll.
          </p>
          <div className="chips">
            {station.ideas.map((idea) => (
              <button type="button" className="chip" key={idea} onClick={() => setPrompt(idea)}>
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}

      {notice ? <p role="alert">{notice}</p> : null}

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          build()
        }}
      >
        <label htmlFor="bau">{current ? "Was soll anders werden?" : "Beschreib es"}</label>
        <textarea
          id="bau"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            current
              ? "Mach die Knöpfe lila und bau einen Timer ein"
              : "Ein Würfel mit einem grossen Knopf"
          }
        />
        <div className="row">
          <button type="submit" disabled={busy || !prompt.trim()}>
            {busy ? "Wird gebaut…" : current ? "Ändern" : "Bauen"}
          </button>
          {artifactId ? (
            <a href={`/galerie/${artifactId}`} className="muted">
              In der Galerie ansehen →
            </a>
          ) : null}
        </div>
      </form>
    </div>
  )
}
