import Link from "next/link"
import { Masthead } from "@/app/masthead"
import { artifacts } from "@/segel/store"

export const dynamic = "force-dynamic"

/** Everything she has built, newest first. */
export default async function GaleriePage() {
  const built = await artifacts().catch(() => [])

  return (
    <main>
      <Masthead here="galerie" />

      <p className="chart-label">Galerie</p>
      <h1>Was du gebaut hast</h1>

      {built.length === 0 ? (
        <p className="muted">
          Noch nichts gebaut. Das kommt in Fahrt 5 — da beschreibst du etwas, und dann gibt es das.
        </p>
      ) : (
        <ul className="voyage-list">
          {built.map((row) => (
            <li key={row.id}>
              <Link className="voyage" href={`/galerie/${row.id}`}>
                <span className="voyage-number">{row.currentVersion}</span>
                <span>
                  <strong>{row.title}</strong>
                  <br />
                  <span className="muted">
                    {row.currentVersion === 1 ? "eine Fassung" : `${row.currentVersion} Fassungen`}{" "}
                    · {row.updatedAt.toLocaleDateString("de-DE")}
                  </span>
                </span>
                {row.shown ? (
                  <span
                    className="stamp"
                    role="img"
                    style={{ marginLeft: "auto" }}
                    aria-label="Hergezeigt"
                  >
                    gezeigt
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
