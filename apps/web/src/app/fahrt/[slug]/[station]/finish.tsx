import { redirect } from "next/navigation"
import { finishStation } from "./actions"

/**
 * Closing a station.
 *
 * A plain form with a server action, so it works with JavaScript off and there
 * is no client bundle for a button that does one thing. The redirect goes back
 * to the voyage rather than onward to the next station on purpose — the
 * curriculum is one station at a sitting, and an app that queues up the next
 * one is an app arguing with its own session cap.
 */
export function FinishStation({ voyageSlug, runId }: { voyageSlug: string; runId: string }) {
  async function finish() {
    "use server"
    await finishStation(voyageSlug, runId)
    redirect(`/fahrt/${voyageSlug}`)
  }

  return (
    <form action={finish} style={{ marginTop: "var(--space-8)" }}>
      <button type="submit" className="quiet">
        Station abschließen
      </button>
    </form>
  )
}
