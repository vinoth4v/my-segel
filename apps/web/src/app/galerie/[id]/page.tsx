import Link from "next/link"
import { notFound } from "next/navigation"
import { GalleryViewer } from "@/app/galerie/[id]/viewer"
import { Masthead } from "@/app/masthead"
import { artifactWithVersions } from "@/segel/store"

export const dynamic = "force-dynamic"

/**
 * One built thing, and every version of it.
 *
 * The version scrubber is the pedagogical payload of the Werkstatt, not a
 * convenience: each version carries the sentence that produced it, so in week
 * six she can watch her own prompts get sharper. That is why versions are
 * never overwritten and why the prompt is stored beside the page.
 */
export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await artifactWithVersions(id).catch(() => undefined)
  if (!found) notFound()

  return (
    <main>
      <Masthead here="galerie" />

      <p className="chart-label">
        <Link href="/galerie">Galerie</Link>
      </p>
      <h1>{found.artifact.title}</h1>

      <GalleryViewer
        id={found.artifact.id}
        shown={found.artifact.shown}
        current={found.artifact.currentVersion}
        versions={found.versions.map((version) => ({
          version: version.version,
          prompt: version.prompt,
          html: version.html,
          escalated: version.escalated,
        }))}
      />
    </main>
  )
}
