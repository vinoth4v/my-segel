/**
 * Runs a database read that the page can live without.
 *
 * The home screen is her Logbuch, and a Logbuch that 500s because the database
 * is briefly unreachable is worse than one that renders empty with a line
 * saying so — she cannot read a stack trace and cannot do anything about it.
 * The same reasoning as the template's audit writes, applied to reads.
 *
 * Only for reads whose absence is survivable. A write that silently does
 * nothing is a different and much worse bug, so this is deliberately not
 * wrapped around those.
 */
export async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch (error) {
    console.error("read failed, falling back", error)
    return fallback
  }
}
