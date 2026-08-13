import type { Message } from "@/kompass"
import type { CallRecord } from "@/segel/router"
import { callStation, PINS } from "@/segel/router"
import { systemFor } from "@/segel/safety"

/**
 * Turning a sentence from a ten-year-old into a page that actually renders.
 *
 * The loop is the valuable part and the reason it is not just one model call:
 * generate, check the result mechanically, and if it fails, hand the model its
 * own error and let it correct itself before escalating to a stronger one.
 * Free models produce broken single-file HTML often enough that without this
 * she would meet a blank frame regularly, and a blank frame in front of a
 * child is a failed session.
 *
 * What it deliberately does *not* do: plan across files, show a diff, or say
 * the word "code". She describes a thing and the thing appears.
 */

const SYSTEM = `${systemFor("werkstatt")}

Du baust genau eine HTML-Datei. Regeln:
- Alles in einer Datei: HTML, CSS in einem <style>-Block, JavaScript in einem <script>-Block.
- Keine externen Dateien, keine CDN-Links, kein fetch, kein localStorage. Nichts aus dem Netz.
- Beginne mit <!doctype html> und ende mit </html>.
- Grosse, gut klickbare Bedienelemente. Lesbare Schrift. Es benutzt ein Kind auf einem Laptop.
- Alle sichtbaren Texte auf Deutsch.
- Antworte ausschliesslich mit der HTML-Datei. Keine Erklärung davor oder danach.`

export type BuildResult = {
  html: string
  title: string
  call: CallRecord
  /** Every repair attempt, for the parent deck. Empty on a clean first build. */
  repairs: string[]
}

/** What the checker complains about, phrased so a model can act on it. */
type Problem = string

/**
 * Mechanical checks on generated HTML.
 *
 * Not a validator — it is the shortest list of failures that actually produce
 * a blank or dangerous frame, checked without a browser. Anything subtler is
 * caught by her looking at it, which is the honest test anyway.
 */
export function inspect(html: string): Problem[] {
  const problems: Problem[] = []
  const lower = html.toLowerCase()

  if (!lower.includes("<html")) problems.push("Es fehlt das <html>-Element.")
  if (!lower.includes("</html>")) problems.push("Die Datei hört mitten drin auf: </html> fehlt.")
  if (!lower.includes("<body")) problems.push("Es fehlt ein <body>.")

  // A page with no visible content renders as a blank frame, which is the
  // exact failure this whole loop exists to prevent.
  const body = html.slice(lower.indexOf("<body"), lower.lastIndexOf("</body>"))
  const visible = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim()
  if (body && !visible && !/<(canvas|svg|img|input|button)/i.test(body)) {
    problems.push("Im <body> ist nichts zu sehen — die Seite bliebe leer.")
  }

  // The sandbox blocks these anyway; catching them here means the model gets
  // told instead of the feature silently not working.
  if (/\bfetch\s*\(|XMLHttpRequest|import\s*\(/i.test(html)) {
    problems.push("Kein Netzwerkzugriff erlaubt: fetch, XMLHttpRequest und import() müssen raus.")
  }
  if (/<script[^>]+src=|<link[^>]+href=["']https?:/i.test(html)) {
    problems.push("Keine externen Dateien: alles muss in dieser einen Datei stehen.")
  }
  if (/localStorage|sessionStorage|document\.cookie/i.test(html)) {
    problems.push("Kein Speicher erlaubt: localStorage, sessionStorage und Cookies müssen raus.")
  }

  const openScripts = (lower.match(/<script/g) ?? []).length
  const closeScripts = (lower.match(/<\/script>/g) ?? []).length
  if (openScripts !== closeScripts) problems.push("Ein <script>-Block ist nicht geschlossen.")

  return problems
}

/**
 * Pulls the file out of whatever the model wrapped it in.
 *
 * Told to answer with only the file, free models still add "Hier ist deine
 * Datei" and a fence about a third of the time. Salvaging that is cheaper
 * than a repair round.
 */
export function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*\n([\s\S]*?)```/i)
  const body = fenced?.[1] ?? raw
  const start = body.search(/<!doctype html|<html/i)
  if (start === -1) return body.trim()
  const end = body.toLowerCase().lastIndexOf("</html>")
  return (end === -1 ? body.slice(start) : body.slice(start, end + "</html>".length)).trim()
}

/** A short name for the gallery, taken from the page's own title. */
export function titleFrom(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([^<]{1,60})<\/title>/i)
  const title = match?.[1]?.trim()
  if (title) return title
  return fallback.length > 48 ? `${fallback.slice(0, 45)}…` : fallback
}

const MAX_REPAIRS = 2

/**
 * Build or change a page, verifying before it is handed back.
 *
 * `previous` is what she is iterating on — passing it in is what makes "mach
 * die Knöpfe lila" work without her re-describing the whole thing.
 */
export async function build(request: {
  prompt: string
  previous?: string
  scaffold?: string
}): Promise<BuildResult> {
  const instruction = request.previous
    ? [
        "Hier ist die aktuelle Datei:",
        request.previous,
        "",
        `Ändere sie so: ${request.prompt}`,
        "Behalte alles andere. Antworte wieder mit der kompletten Datei.",
      ].join("\n")
    : request.prompt

  const system = request.scaffold ? `${SYSTEM}\n\n${request.scaffold}` : SYSTEM
  const repairs: string[] = []

  let messages: Message[] = [{ role: "user", content: instruction }]
  let lastCall: CallRecord | undefined
  let lastHtml = ""

  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt += 1) {
    // The escalation ladder: the pinned coder, then the other free coder,
    // then whatever the agentic lane can serve. callStation already retries a
    // hard failure; this handles the case where it answered but the answer
    // does not work, which no gateway can detect for us.
    const override =
      attempt === 0 ? PINS.werkstatt[0] : attempt === 1 ? PINS.werkstatt[1] : undefined

    const reply = await callStation("werkstatt", messages, {
      system,
      ...(override ? { overrideModel: override } : {}),
      maxTokens: 4000,
    })

    const html = extractHtml(reply.text)
    const problems = inspect(html)
    lastCall = { ...reply.call, escalated: reply.call.escalated || attempt > 0 }
    lastHtml = html

    if (problems.length === 0) {
      return {
        html,
        title: titleFrom(html, request.prompt),
        call: {
          ...lastCall,
          escalationReason:
            attempt > 0
              ? `${attempt} Reparaturversuch(e): ${repairs.join(" | ")}`
              : lastCall.escalationReason,
        },
        repairs,
      }
    }

    repairs.push(problems.join(" "))

    // Hand the model its own output and the specific complaint. Generic
    // "try again" produces the same failure; the error text is what makes
    // the correction work.
    messages = [
      { role: "user", content: instruction },
      { role: "assistant" as const, content: html },
      {
        role: "user",
        content: `Das läuft so nicht. Folgende Probleme: ${problems.join(" ")} Schick die komplette, korrigierte Datei — nur die Datei.`,
      },
    ]
  }

  // Out of attempts. Hand back the last try rather than nothing: a page that
  // renders imperfectly still beats an error message, and the parent deck
  // records that this one needed every attempt.
  return {
    html: lastHtml || FALLBACK_PAGE,
    title: titleFrom(lastHtml, request.prompt),
    call: lastCall
      ? {
          ...lastCall,
          escalated: true,
          escalationReason: `nach ${MAX_REPAIRS} Reparaturversuchen weiterhin fehlerhaft: ${repairs.join(" | ")}`,
        }
      : {
          model: "keins",
          lane: "",
          servedBy: "",
          escalated: true,
          escalationReason: "kein Modell hat geantwortet",
          inputTokens: 0,
          outputTokens: 0,
        },
    repairs,
  }
}

/** Shown only if every attempt produced nothing at all. Still honest. */
const FALLBACK_PAGE = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Nicht geklappt</title></head>
<body style="font-family:system-ui;padding:2rem">
<h1>Das hat diesmal nicht geklappt</h1>
<p>Das Modell hat keine funktionierende Seite gebaut. Beschreib es noch einmal etwas anders —
manchmal reicht ein Satz mehr.</p>
</body></html>`
