import { type NextRequest, NextResponse } from "next/server"
import { takeTurn, turnSchema } from "@/lib/station-api"

/**
 * One turn of a conversational station — `talk` and `jagd` both.
 *
 * Which model answers is decided here, from the station's type, and never sent
 * by the browser. That is not defensiveness about a ten-year-old tampering
 * with a fetch call; it is that the routing *is* the curriculum, and a client
 * that can name its own model is a client that can accidentally route the
 * hunt to a good model and delete the lesson.
 */
export async function POST(request: NextRequest) {
  const parsed = turnSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ kind: "error", message: "Ungültige Anfrage." }, { status: 400 })
  }

  const result = await takeTurn(parsed.data)
  return NextResponse.json(result)
}
