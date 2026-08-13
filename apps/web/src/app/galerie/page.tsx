import Link from "next/link"
import { Deckhead } from "@/components/deckhead"
import { galerie } from "@/db/segel"
import { safely } from "@/lib/safely"

export const dynamic = "force-dynamic"

/** Everything she has built, newest first. */
export default async function GaleriePage() {
  const works = await safely(() => galerie(), [])

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">Galerie</p>
        <h1>{works.length === 0 ? "Noch nichts gebaut" : `${works.length} Werkstücke`}</h1>

        {works.length === 0 ? (
          <p className="lead muted">
            In der Werkstatt beschreibst du etwas, und es entsteht. Was du baust, landet hier.
          </p>
        ) : (
          <ul className="voyages">
            {works.map((work) => (
              <li key={work.id}>
                <Link href={`/galerie/${work.id}`} className="voyage">
                  <span className="voyage-number">·</span>
                  <span>
                    <h3>{work.title}</h3>
                    <p>{work.updatedAt.toLocaleDateString("de-DE")}</p>
                  </span>
                  <span className="muted">ansehen</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p>
          <Link href="/">Zurück zum Logbuch</Link>
        </p>
      </main>
    </>
  )
}
