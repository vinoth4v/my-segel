"use client"

import { useState } from "react"
import { fileEntry } from "@/app/fahrt/[slug]/[station]/actions"
import type { WerkstattStation as WerkstattStationContent } from "@/content/schema"

/**
 * Die Werkstatt.
 *
 * She describes; it builds; she changes it in plain language. The version
 * history is kept with the sentence that produced each version, and she can
 * scrub back through it — which is the actual lesson of the station. Her first
 * description is always vague and her fifth is not, and seeing that is worth
 * more than the thing she built.
 *
 * The frame is sandboxed without `allow-same-origin`, so the artifact runs in
 * an opaque origin and cannot touch this page. The rest of the policy is a CSP
 * header on the route that serves it. She never sees the code — the moment she
 * does, the app is teaching her to be a junior developer instead of teaching
 * her how the thing behaves.
 */
export function WerkstattStation({
  runId,
  voyageSlug,
  station,
}: {
  runId: string
  voyageSlug: string
  station: WerkstattStationContent
}) {
  const [artifactId, setArtifactId] = useState<string | null>(null)
  const [versions, setVersions] = useState<{ version: number; prompt: string }[]>([])
  const [showing, setShowing] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState<string | null>(null)
  const [shown, setShown] = useState(false)

  async function build(wish: string) {
    const trimmed = wish.trim()
    if (!trimmed || busy) return

    setBusy(true)
    setHeld(null)

    try {
      const response = await fetch("/api/station/werkstatt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          request: trimmed,
          ...(artifactId ? { artifactId } : {}),
        }),
      })
      const result = await response.json()

      if (result.kind === "built") {
        setArtifactId(result.artifactId)
        setVersions((previous) => [...previous, { version: result.version, prompt: trimmed }])
        setShowing(result.version)
        setDraft("")
      } else {
        setHeld(result.message ?? "Das hat nicht geklappt.")
      }
    } catch {
      setHeld("Die Verbindung ist weg. Versuch es nochmal.")
    } finally {
      setBusy(false)
    }
  }

  const current = showing ?? versions[versions.length - 1]?.version ?? null

  return (
    <>
      {held ? <p role="alert">{held}</p> : null}

      {!artifactId ? (
        <>
          <p className="chartlabel">Ideen, falls dir keine einfällt</p>
          <div className="chips">
            {station.ideas.map((idea) => (
              <button type="button" key={idea} onClick={() => build(idea)} disabled={busy}>
                {idea}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {artifactId && current ? (
        <>
          <iframe
            key={`${artifactId}-${current}`}
            className="artifact-frame"
            title="Dein Werkstück"
            src={`/api/artifact/${artifactId}/${current}`}
            sandbox="allow-scripts"
          />

          <p className="row">
            <span className="chartlabel">Versionen</span>
            {versions.map((entry) => (
              <button
                type="button"
                key={entry.version}
                className="quiet"
                onClick={() => setShowing(entry.version)}
                disabled={entry.version === current}
              >
                {entry.version}
              </button>
            ))}
          </p>

          {versions.length > 1 ? (
            <div className="panel">
              <p className="chartlabel">Was du geschrieben hast</p>
              {versions.map((entry) => (
                <p key={entry.version} className={entry.version === current ? undefined : "muted"}>
                  <strong>{entry.version}.</strong> {entry.prompt}
                </p>
              ))}
              <p className="muted">
                Vergleich deine erste Beschreibung mit deiner letzten. Das ist der Unterschied.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void build(draft)
        }}
      >
        <label htmlFor="werkstatt-input">
          {artifactId ? "Was soll anders sein?" : "Was willst du bauen?"}
        </label>
        <textarea
          id="werkstatt-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={
            artifactId ? "Mach die Knöpfe orange" : "Beschreib es so genau, wie du kannst"
          }
        />
        <p>
          <button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Wird gebaut" : artifactId ? "Ändern" : "Bauen"}
          </button>
        </p>
      </form>

      {artifactId && !shown ? (
        <p className="notice">
          Fertig?{" "}
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setShown(true)
              void fileEntry({
                kind: "build",
                voyageSlug,
                stationId: station.id,
                runId,
                title: versions[0]?.prompt ?? "Werkstück",
                detail: `${versions.length} ${versions.length === 1 ? "Version" : "Versionen"}`,
              })
            }}
          >
            Ins Logbuch eintragen
          </button>{" "}
          und jemandem zeigen.
        </p>
      ) : null}
    </>
  )
}
