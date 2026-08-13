import { describe, expect, it } from "vitest"
import { extractHtml, inspect, titleFrom } from "./werkstatt.ts"

const GOOD = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Würfel</title></head>
<body><h1>Würfel</h1><button id="w">Würfeln</button><script>document.getElementById("w")</script></body></html>`

describe("inspecting generated pages", () => {
  it("passes a page that would actually render", () => {
    expect(inspect(GOOD)).toEqual([])
  })

  it("catches the blank frame, which is the failure this loop exists for", () => {
    const blank = `<!doctype html><html><head><title>x</title></head><body><script>var a=1</script></body></html>`
    expect(inspect(blank).join(" ")).toContain("leer")
  })

  it("catches a truncated file", () => {
    expect(inspect(`<!doctype html><html><body><h1>halb`).join(" ")).toContain("</html>")
  })

  it("catches an unclosed script block", () => {
    const broken = `<!doctype html><html><body><h1>hi</h1><script>var a=1</body></html>`
    expect(inspect(broken).join(" ")).toContain("script")
  })

  it("refuses network access and external files, which the sandbox blocks anyway", () => {
    // Caught here so the model gets told and fixes it, rather than the
    // feature silently not working inside the sandbox.
    const fetching = `<!doctype html><html><body><h1>hi</h1><script>fetch("/x")</script></body></html>`
    expect(inspect(fetching).join(" ")).toContain("fetch")

    const external = `<!doctype html><html><head><script src="https://cdn.example.com/x.js"></script></head><body><h1>hi</h1></body></html>`
    expect(inspect(external).join(" ")).toContain("externe")
  })

  it("accepts a canvas-only page as visible", () => {
    const canvas = `<!doctype html><html><body><canvas id="c"></canvas><script>var a=1</script></body></html>`
    expect(inspect(canvas)).toEqual([])
  })
})

describe("salvaging the model's answer", () => {
  it("strips a fence and the chatter around it", () => {
    const wrapped = `Hier ist deine Datei:\n\n\`\`\`html\n${GOOD}\n\`\`\`\n\nViel Spass`
    expect(extractHtml(wrapped)).toBe(GOOD)
  })

  it("strips chatter even without a fence", () => {
    expect(extractHtml(`Klar, gerne. ${GOOD} Fertig.`)).toBe(GOOD)
  })

  it("leaves a clean answer alone", () => {
    expect(extractHtml(GOOD)).toBe(GOOD)
  })
})

describe("naming a build", () => {
  it("prefers the page's own title", () => {
    expect(titleFrom(GOOD, "irgendwas")).toBe("Würfel")
  })

  it("falls back to her own words, shortened", () => {
    const long = "a".repeat(80)
    expect(titleFrom("<html></html>", long)).toHaveLength(46)
  })
})
