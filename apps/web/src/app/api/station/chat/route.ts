import type { Message } from "@/kompass"
import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body, guard } from "@/segel/guard"
import { callStation } from "@/segel/router"
import {
  checkInput,
  checkOutput,
  HOMEWORK_REPLY,
  looksLikeHomework,
  systemFor,
} from "@/segel/safety"
import { recordTurn } from "@/segel/store"

/**
 * The conversation stations: Gespräch and Die Jagd.
 *
 * One handler for both, because the difference between them is entirely in
 * the route table and the station's own scaffold — Die Jagd is a normal
 * conversation with a model that is not very good, and pretending otherwise
 * in the code would invite someone to "fix" it later.
 */

type Body = {
  voyageId?: string
  stationId?: string
  messages?: { role: "user" | "assistant"; content: string }[]
}

export async function POST(request: Request) {
  const gate = await guard()
  if (gate.blocked) return gate.response

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station) return badRequest("Diese Station gibt es nicht.")
  if (station.type !== "talk" && station.type !== "jagd") {
    return badRequest("Diese Station ist kein Gespräch.")
  }

  const history = (input.messages ?? []).slice(-12)
  const latest = history.at(-1)
  if (latest?.role !== "user") return badRequest("Die letzte Nachricht fehlt.")

  const verdict = checkInput(latest.content)
  if (!verdict.ok) {
    // Never leaves the server. Recorded so the parent can see it came up,
    // and so a pattern of near-misses is visible rather than invisible.
    await recordTurn({
      voyageId: voyage.id,
      stationId: station.id,
      stationType: station.type,
      role: "system",
      content: `Eingabe blockiert (${verdict.reason})`,
      flagged: true,
      flagReason: verdict.reason,
    })
    return Response.json({ refused: verdict.reason, message: verdict.message })
  }

  await recordTurn({
    voyageId: voyage.id,
    stationId: station.id,
    stationType: station.type,
    role: "kind",
    content: verdict.text,
  })

  // Checked before the call, so a weak model on Die Jagd cannot cheerfully
  // do her homework while the system prompt is being ignored.
  if (looksLikeHomework(verdict.text)) {
    await recordTurn({
      voyageId: voyage.id,
      stationId: station.id,
      stationType: station.type,
      role: "modell",
      content: HOMEWORK_REPLY,
      flagged: true,
      flagReason: "hausaufgabe",
    })
    return Response.json({ text: HOMEWORK_REPLY, refusedHomework: true })
  }

  const messages: Message[] = history.map((message) => ({
    role: message.role,
    content: message.content,
  }))

  try {
    const reply = await callStation(station.type, messages, {
      system: systemFor(station.type, station.scaffold),
    })

    const output = checkOutput(reply.text)

    await recordTurn({
      voyageId: voyage.id,
      stationId: station.id,
      stationType: station.type,
      role: "modell",
      content: output.ok ? output.text : `[gefiltert: ${output.matched}] ${reply.text}`,
      call: reply.call,
      flagged: !output.ok,
      ...(output.ok ? {} : { flagReason: output.matched }),
    })

    return Response.json({
      text: output.text,
      filtered: !output.ok,
      // Named so Die Jagd can show her which model she just caught. Part of
      // the lesson: the thing that was wrong has a name and a size.
      model: reply.call.servedBy || reply.call.model,
    })
  } catch (error) {
    console.error("chat station failed", error)
    return Response.json(
      { message: "Kein Modell antwortet gerade. Versuch es gleich noch einmal." },
      { status: 503 },
    )
  }
}
