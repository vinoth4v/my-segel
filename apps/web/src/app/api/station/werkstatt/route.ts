import { stationIn, voyageById } from "@/segel/content"
import { badRequest, body, guard } from "@/segel/guard"
import { checkInput } from "@/segel/safety"
import {
  addVersion,
  artifactWithVersions,
  createArtifact,
  fileEntry,
  markStation,
  recordTurn,
  versionHtml,
} from "@/segel/store"
import { build } from "@/segel/werkstatt"

/**
 * Werkstatt: she describes a thing, and the thing appears.
 *
 * A first request creates an artifact; every later one adds a version to it,
 * keeping the sentence that produced each. The version history is not an undo
 * feature — it is the point of the station, because scrubbing back through it
 * in week six is how she sees her own prompting get better.
 */

type Body = {
  voyageId?: string
  stationId?: string
  prompt?: string
  /** Absent on the first build; present when she is changing something. */
  artifactId?: string
}

export async function POST(request: Request) {
  const gate = await guard()
  if (gate.blocked) return gate.response

  const input = await body<Body>(request)
  if (!input?.voyageId || !input.stationId) return badRequest("voyageId und stationId fehlen.")

  const voyage = voyageById(input.voyageId)
  const station = voyage && stationIn(voyage, input.stationId)
  if (!voyage || !station || station.type !== "werkstatt") {
    return badRequest("Diese Station gibt es nicht.")
  }

  const verdict = checkInput(input.prompt ?? "")
  if (!verdict.ok) return Response.json({ refused: verdict.reason, message: verdict.message })

  await recordTurn({
    voyageId: voyage.id,
    stationId: station.id,
    stationType: "werkstatt",
    role: "kind",
    content: verdict.text,
  })

  let previous: string | undefined
  if (input.artifactId) {
    const existing = await currentHtml(input.artifactId)
    if (!existing) return badRequest("Dieses Werkstück gibt es nicht.")
    previous = existing
  }

  try {
    const result = await build({
      prompt: verdict.text,
      ...(previous ? { previous } : {}),
      ...(station.scaffold ? { scaffold: station.scaffold } : {}),
    })

    await recordTurn({
      voyageId: voyage.id,
      stationId: station.id,
      stationType: "werkstatt",
      role: "modell",
      // The HTML itself goes to the artifact table; the transcript records
      // that a build happened and how hard it was, which is what the parent
      // deck actually needs to read.
      content: `Gebaut: ${result.title}${result.repairs.length ? ` (${result.repairs.length} Reparaturversuch(e))` : ""}`,
      call: result.call,
    })

    if (input.artifactId) {
      const version = await addVersion(input.artifactId, {
        prompt: verdict.text,
        html: result.html,
        model: result.call.model,
        escalated: result.call.escalated,
      })
      return Response.json({
        artifactId: input.artifactId,
        version,
        html: result.html,
        title: result.title,
        repaired: result.repairs.length,
      })
    }

    const row = await createArtifact({
      voyageId: voyage.id,
      stationId: station.id,
      title: result.title,
      prompt: verdict.text,
      html: result.html,
      model: result.call.model,
      escalated: result.call.escalated,
    })

    await fileEntry({
      kind: "build",
      voyageId: voyage.id,
      stationId: station.id,
      title: result.title,
      detail: verdict.text,
      payload: { artifactId: row.id },
    })

    await markStation(voyage.id, station.id, { complete: true })

    return Response.json({
      artifactId: row.id,
      version: 1,
      html: result.html,
      title: result.title,
      repaired: result.repairs.length,
    })
  } catch (error) {
    console.error("werkstatt build failed", error)
    return Response.json(
      { message: "Das Bauen hat nicht geklappt. Beschreib es noch einmal etwas anders." },
      { status: 503 },
    )
  }
}

async function currentHtml(artifactId: string): Promise<string | undefined> {
  const found = await artifactWithVersions(artifactId)
  if (!found) return undefined
  const row = await versionHtml(artifactId, found.artifact.currentVersion)
  return row?.html
}
