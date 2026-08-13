import { NextResponse } from "next/server"
import { artifactById, versionsOf } from "@/db/segel"
import { ARTIFACT_CSP } from "@/lib/artifact"

/**
 * Serves one version of one artifact, for the sandboxed frame to load.
 *
 * Served from a route rather than handed to the iframe as `srcdoc` so the
 * policy can be a real Content-Security-Policy *header*. A `<meta>` CSP inside
 * generated markup is advisory in a way a header is not, and this is generated
 * markup running with `allow-scripts`.
 *
 * Two layers, and they cover different things. The iframe's `sandbox`
 * attribute — deliberately without `allow-same-origin` — gives the frame an
 * opaque origin, so it cannot read this app's DOM, cookies or storage. The CSP
 * here gives it nowhere to send anything: `default-src 'none'`, no connect-src
 * at all, no form-action. Her code can do whatever it likes to its own
 * rectangle and nothing outside it.
 *
 * Still behind the session gate, because these are her things.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params

  const owned = await artifactById(id)
  if (!owned) return new NextResponse("not found", { status: 404 })

  const versions = await versionsOf(id)
  const wanted = Number(version)
  const found = Number.isFinite(wanted)
    ? versions.find((row) => row.version === wanted)
    : versions[versions.length - 1]

  if (!found) return new NextResponse("not found", { status: 404 })

  return new NextResponse(found.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": ARTIFACT_CSP,
      // Belt and braces: even if the frame is ever given same-origin, these
      // stop the document being treated as anything but an isolated page.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
}
