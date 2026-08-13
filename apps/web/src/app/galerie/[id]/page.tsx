import Link from "next/link"
import { notFound } from "next/navigation"
import { Deckhead } from "@/components/deckhead"
import { artifactById, versionsOf } from "@/db/segel"

export const dynamic = "force-dynamic"

/**
 * One work, and the trail of versions behind it.
 *
 * The version list is the reason this page exists. Replforge's checkpoints
 * were an undo mechanism; here they are the lesson — her first description
 * next to her fifth, in her own words, with the thing each one produced. She
 * can see her own prompting get sharper, which is not a thing anyone can tell
 * her convincingly.
 */
export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const work = await artifactById(id)
  if (!work) notFound()

  const versions = await versionsOf(id)
  const latest = versions[versions.length - 1]

  return (
    <>
      <Deckhead />
      <main>
        <p className="chartlabel">Galerie · {work.createdAt.toLocaleDateString("de-DE")}</p>
        <h1>{work.title}</h1>

        {latest ? (
          <iframe
            className="artifact-frame"
            title={work.title}
            src={`/api/artifact/${work.id}/${latest.version}`}
            sandbox="allow-scripts"
          />
        ) : (
          <p className="muted">Von diesem Werkstück gibt es keine Version.</p>
        )}

        <section className="panel" style={{ marginTop: "var(--space-6)" }}>
          <p className="chartlabel">Wie es dazu kam</p>
          {versions.map((version) => (
            <p key={version.id}>
              <strong>{version.version}.</strong> {version.prompt}{" "}
              <Link href={`/api/artifact/${work.id}/${version.version}`}>ansehen</Link>
              {version.escalated ? <span className="muted"> · eskaliert</span> : null}
            </p>
          ))}
          {versions.length > 1 ? (
            <p className="muted">
              Lies deine erste Beschreibung und deine letzte laut vor. Der Unterschied ist das, was
              du gelernt hast.
            </p>
          ) : null}
        </section>

        <p>
          <Link href="/galerie">Zurück zur Galerie</Link>
        </p>
      </main>
    </>
  )
}
