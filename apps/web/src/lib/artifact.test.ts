import { describe, expect, it } from "vitest"
import { ARTIFACT_CSP, checkArtifact, extractHtml } from "./artifact.ts"

const page = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Würfel</title>
<style>body{font-size:2rem}</style></head><body><h1>Würfel</h1>
<button id="w">Würfeln</button><p id="out">—</p>
<script>document.getElementById("w").onclick=()=>{document.getElementById("out").textContent=1+Math.floor(Math.random()*6)}</script>
</body></html>`

describe("pulling an artifact out of a reply", () => {
  it("takes a bare document", () => {
    expect(extractHtml(page)).toContain("<h1>Würfel</h1>")
  })

  it("takes a document out of a code fence", () => {
    const html = extractHtml("Klar, hier ist es:\n\n```html\n" + page + "\n```\n\nViel Spaß.")
    expect(html).toContain("<h1>Würfel</h1>")
    expect(html).not.toContain("Viel Spaß")
  })

  it("strips prose a chatty model wrapped around the document", () => {
    const html = extractHtml(`Gerne! Ich habe dir das gebaut.\n\n${page}\n\nSag Bescheid.`)
    expect(html?.startsWith("<!doctype html")).toBe(true)
    expect(html?.endsWith("</html>")).toBe(true)
  })

  it("wraps a bare fragment in a document rather than rejecting it", () => {
    // A very common free-model shape, and perfectly renderable once it is
    // given a document to live in — rejecting it would burn a fallback.
    const html = extractHtml("<div id='app'><h1>Hallo</h1><button>Klick</button></div>")
    expect(html).toContain("<!doctype html")
    expect(html).toContain("<button>Klick</button>")
  })

  it("returns nothing when the reply is only prose", () => {
    expect(extractHtml("Ich kann leider keine Webseiten bauen.")).toBeNull()
  })
})

describe("deciding whether an artifact may be shown", () => {
  it("accepts a complete page", () => {
    const result = checkArtifact(page)
    expect(result.ok).toBe(true)
  })

  it("rejects a reply with no markup, so the gateway tries another model", () => {
    const result = checkArtifact("Das kann ich nicht.")
    expect(result.ok).toBe(false)
  })

  it("rejects a truncated page — the blank-frame case", () => {
    // Cut mid-script. This is the failure the acceptance test is about: the
    // call succeeded, the reply looks like HTML, and the frame renders white.
    const truncated = page.slice(0, page.indexOf("<script>") + 40)
    const result = checkArtifact(truncated)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/truncated/)
  })

  it("rejects a page that reaches for the network", () => {
    const external = page.replace(
      "<style>",
      '<script src="https://cdn.example.com/x.js"></script><style>',
    )
    const result = checkArtifact(external)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/external/)
  })

  it("rejects something too short to be a page", () => {
    expect(checkArtifact("<div>hi</div>").ok).toBe(false)
  })
})

describe("the artifact frame's policy", () => {
  it("denies everything by default and allows no network at all", () => {
    expect(ARTIFACT_CSP).toContain("default-src 'none'")
    expect(ARTIFACT_CSP).not.toMatch(/connect-src [^;]*https?:/)
    expect(ARTIFACT_CSP).toContain("form-action 'none'")
  })
})
