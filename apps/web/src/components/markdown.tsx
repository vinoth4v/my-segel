import type { ReactNode } from "react"

/**
 * The little bit of Markdown the curriculum actually uses.
 *
 * Paragraphs, bullet lists, numbered lists and bold. That is the whole set,
 * and it is checked by the content living in this repo rather than coming from
 * anywhere else — so a Markdown library would be several hundred kilobytes to
 * render four constructs.
 *
 * It builds React nodes rather than HTML, which means there is no
 * `dangerouslySetInnerHTML` anywhere in an app that renders model output on
 * the next screen over. That is the actual reason to keep this, not the size.
 */

export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/)

  return (
    <>
      {blocks.map((block, index) => {
        const key = `${index}-${block.slice(0, 16)}`
        const lines = block.split("\n")

        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return (
            <ul key={key}>
              {lines.map((line) => (
                <li key={line}>{inline(line.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          )
        }

        if (lines.every((line) => /^\d+\.\s+/.test(line))) {
          return (
            <ol key={key}>
              {lines.map((line) => (
                <li key={line}>{inline(line.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          )
        }

        return <p key={key}>{inline(block)}</p>
      })}
    </>
  )
}

/** Bold only. Anything else in the source renders as the characters typed. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) => {
    const key = `${index}-${part.slice(0, 12)}`
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    return <span key={key}>{part}</span>
  })
}
