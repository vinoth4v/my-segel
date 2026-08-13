import { color } from "@werft/tokens"
import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
// Tokens first: globals.css consumes the custom properties this defines.
import "@werft/tokens/tokens.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "Segel",
  description: "Sechs Fahrten, um zu verstehen, was diese Modelle wirklich tun.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: color.bg.light },
    { media: "(prefers-color-scheme: dark)", color: color.bg.dark },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // German throughout: the copy, the station names and the model's own
  // replies are all German, and the wrong lang attribute is what makes a
  // screen reader mispronounce every word on the page.
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
