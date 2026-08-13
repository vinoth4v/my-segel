import Link from "next/link"

/** The one piece of chrome. Present on every surface she can reach. */
export function Masthead({ here }: { here?: "logbuch" | "galerie" | "deck" }) {
  return (
    <header className="masthead">
      <Link className="wordmark" href="/">
        Segel
      </Link>
      <nav>
        <Link href="/" aria-current={here === "logbuch" ? "page" : undefined}>
          Logbuch
        </Link>
        <Link href="/galerie" aria-current={here === "galerie" ? "page" : undefined}>
          Galerie
        </Link>
        <Link href="/deck" aria-current={here === "deck" ? "page" : undefined}>
          Kapitän
        </Link>
      </nav>
    </header>
  )
}
