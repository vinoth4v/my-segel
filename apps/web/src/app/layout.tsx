import { THEMES } from "@werft/tokens"
import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
// Tokens first: globals.css consumes the custom properties this defines.
import "@werft/tokens/tokens.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "Segel",
  description: "Sechs Fahrten, um herauszufinden, wie KI wirklich funktioniert.",
}

/**
 * The browser chrome takes the harbour navy too, rather than the token
 * package's default — the app is themed `segel`, and a zinc address bar around
 * a navy page is the sort of small wrongness that reads as unfinished.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEMES.segel.color.bg.light },
    { media: "(prefers-color-scheme: dark)", color: THEMES.segel.color.bg.dark },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
