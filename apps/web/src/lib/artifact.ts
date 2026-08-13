/**
 * Turning a model's reply into something that renders.
 *
 * The Werkstatt acceptance test is ten consecutive builds with no blank frame,
 * and the reason that is hard has nothing to do with the model being clever:
 * free code models return HTML wrapped in prose, or in a fence, or truncated
 * mid-tag, often enough that "just render the reply" fails several times in
 * ten. So the reply is extracted, checked, and only *then* accepted — and a
 * reply that fails the check is treated as a failed call, which sends the
 * gateway to the next model rather than showing her nothing.
 *
 * This is the replforge verify-then-report contract, narrowed to one file.
 */

/** Long enough to be a page, short enough to survive a database row and an iframe. */
const MIN_HTML_CHARS = 120
const MAX_HTML_CHARS = 120_000

/**
 * Pulls the document out of whatever the model actually sent.
 *
 * Three shapes, in the order they occur in practice: a fenced block, a bare
 * document, or prose with a document buried in it.
 */
export function extractHtml(reply: string): string | null {
  const fenced = reply.match(/```(?:html)?\s*\n([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? reply).trim()

  const start = candidate.search(/<!doctype html|<html[\s>]/i)
  if (start >= 0) {
    const end = candidate.toLowerCase().lastIndexOf("</html>")
    return end > start ? candidate.slice(start, end + "</html>".length) : candidate.slice(start)
  }

  // No <html> wrapper but real markup — common, and perfectly renderable once
  // it is given a document to live in.
  if (/<(div|body|canvas|button|h1|p|style|script|main|section)[\s>]/i.test(candidate)) {
    return wrapFragment(candidate)
  }

  return null
}

function wrapFragment(fragment: string): string {
  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
${fragment}
</body>
</html>`
}

export type ArtifactCheck = { ok: true; html: string } | { ok: false; reason: string }

/**
 * Would this actually render?
 *
 * Cheap structural checks only — there is no browser here to run it in. They
 * catch the failures that produce a blank frame (nothing extracted, truncated
 * mid-document, a shell with no content), which is the class that matters. A
 * page that renders but is ugly is her problem to iterate on, and iterating is
 * the lesson.
 */
export function checkArtifact(reply: string): ArtifactCheck {
  const html = extractHtml(reply)
  if (!html) return { ok: false, reason: "no html in reply" }
  if (html.length > MAX_HTML_CHARS) return { ok: false, reason: "html too large" }
  if (hasNetworkEgress(html)) return { ok: false, reason: "tried to load something external" }

  // Truncation is checked before size, because a reply cut off mid-script is
  // also short — and "truncated" is the diagnosis worth recording, since it
  // means retrying may well work while "too short" means the model misread
  // the request.
  const opens = (html.match(/<script[\s>]/gi) ?? []).length
  const closes = (html.match(/<\/script>/gi) ?? []).length
  if (opens !== closes) return { ok: false, reason: "unbalanced script tags — likely truncated" }

  if (!/<\/(body|html|div|main|section|p|h1|button|canvas)>/i.test(html)) {
    return { ok: false, reason: "no closed element — likely truncated" }
  }

  // Measured on the content, not the document, so the boilerplate this file
  // adds around a bare fragment cannot make an empty artifact look substantial.
  if (contentLength(html) < MIN_HTML_CHARS) {
    return { ok: false, reason: "html too short to be a page" }
  }

  return { ok: true, html }
}

/** The document minus the parts that are the same in every artifact. */
function contentLength(html: string): number {
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<head>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?(html|body)[^>]*>/gi, "")
    .trim().length
}

/**
 * Generated code must not reach the network.
 *
 * The iframe is already sandboxed without `allow-same-origin`, and a strict
 * CSP blocks this at render time too — but a model that keeps reaching for a
 * CDN produces a page that silently half-works, and half-working in front of a
 * ten-year-old is worse than a retry. So it fails the check and the gateway
 * tries again with the instruction still in the prompt.
 */
function hasNetworkEgress(html: string): boolean {
  return /\b(src|href)\s*=\s*["']?(https?:)?\/\//i.test(html) || /\bfetch\s*\(/i.test(html)
}

/**
 * The Content-Security-Policy the artifact frame is served with.
 *
 * `sandbox` on the iframe element stops it reaching this origin; this stops it
 * reaching any other. Inline script and style are allowed because a
 * single-file artifact is nothing but inline script and style — the point is
 * that `default-src 'none'` leaves it nowhere to send anything.
 */
export const ARTIFACT_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ")

/**
 * The brief the model builds against.
 *
 * Written as constraints rather than encouragement because the constraints are
 * what make the output renderable — one file, no network, works on first load.
 */
export const WERKSTATT_SYSTEM_PROMPT = `Du baust kleine Web-Seiten für ein zehnjähriges Kind, das beschreibt, was es haben will.

Antworte ausschließlich mit einer einzigen vollständigen HTML-Datei. Kein Text davor, keine Erklärung danach, keine Code-Fences.

Regeln, die die Datei erfüllen muss:
- Alles in einer Datei: HTML, CSS im <style>, JavaScript im <script>. Keine externen Dateien.
- Niemals etwas aus dem Netz laden. Keine URLs, kein fetch, keine CDN-Links, keine Google Fonts, keine Bilder von außen. Bilder nur als CSS-Formen, Emoji oder inline-SVG.
- Muss sofort beim Öffnen funktionieren, ohne Klick auf einen Start-Knopf.
- Große Schrift, große Klickflächen, funktioniert auf einem Laptop und auf einem Tablet.
- Deutsche Beschriftungen.
- Kurz und robust: lieber weniger, das sicher läuft, als viel, das kaputtgeht.

Wenn die Beschreibung unklar ist, triff eine vernünftige Annahme und baue etwas Funktionierendes. Frage nicht nach.`

/** The change request, phrased so the model edits rather than starts over. */
export function iterationPrompt(currentHtml: string, request: string): string {
  return `Hier ist die aktuelle Datei:

${currentHtml}

Änderungswunsch des Kindes: "${request}"

Gib die vollständige geänderte Datei zurück. Ändere nur, was gewünscht ist, und lass den Rest so, wie er ist.`
}
