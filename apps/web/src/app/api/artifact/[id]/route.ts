import { auth } from "@/auth"
import { badRequest, body } from "@/segel/guard"
import { artifactWithVersions, setCurrentVersion, setShown } from "@/segel/store"

/**
 * The two things she can change about a finished build: which version counts
 * as the real one, and whether she has shown it to somebody.
 *
 * "Shown to someone" is tracked because it is one of the app's stated goals —
 * three things built *and shown* — and a goal nobody records is a goal
 * nobody measures.
 *
 * Deleting is deliberately absent. Nothing she makes is removable from here.
 */

type Body = { shown?: boolean; setCurrent?: number }

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 })

  const { id } = await context.params
  const input = await body<Body>(request)
  if (!input) return badRequest("Kein Inhalt.")

  const found = await artifactWithVersions(id)
  if (!found) return badRequest("Dieses Werkstück gibt es nicht.")

  if (typeof input.shown === "boolean") {
    await setShown(id, input.shown)
  }

  if (typeof input.setCurrent === "number") {
    const exists = found.versions.some((version) => version.version === input.setCurrent)
    if (!exists) return badRequest("Diese Fassung gibt es nicht.")
    await setCurrentVersion(id, input.setCurrent)
  }

  return Response.json({ ok: true })
}
