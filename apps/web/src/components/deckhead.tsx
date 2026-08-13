import Link from "next/link"

/**
 * The chrome. Four places, and no more — the Logbuch is the home screen, so
 * "back to the Logbuch" is the wordmark itself rather than a fifth link.
 *
 * The Kapitäns-Deck is listed for her to see. It is not hidden, because a
 * child who knows her father can read the transcripts behaves differently from
 * one who finds out later that he could.
 */
export function Deckhead() {
  return (
    <header className="deckhead">
      <Link href="/" className="wordmark">
        Segel
      </Link>
      <nav>
        <Link href="/">Logbuch</Link>
        <Link href="/galerie">Galerie</Link>
        <Link href="/deck">Kapitäns-Deck</Link>
      </nav>
    </header>
  )
}
