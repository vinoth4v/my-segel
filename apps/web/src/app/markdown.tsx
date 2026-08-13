import type { ReactNode } from "react"

/**
 * The small amount of Markdown the curriculum actually uses.
 *
 * A Markdown library is not on the blessed dependency list, and the content
 * is written by us rather than by a user, so the honest options are "add a
 * dependency and ask" or "support the four things the six voyages use".
 * This is the second one: paragraphs, bold, numbered and bulleted lists.
 *
 * It renders text, never HTML — there is no dangerouslySetInnerHTML here, so
 * a future voyage authored by a model cannot inject markup into her page.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)

  return (
    <>
      {blocks.map((block, index) => {
        const lines = block.split("\n")
        const key = `${index}-${block.slice(0, 24)}`

        if (lines.every((line) => /^\d+\.\s/.test(line))) {
          return (
            <ol key={key}>
              {lines.map((line) => (
                <li key={line}>{inline(line.replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          )
        }

        if (lines.every((line) => /^[-*]\s/.test(line))) {
          return (
            <ul key={key}>
              {lines.map((line) => (
                <li key={line}>{inline(line.replace(/^[-*]\s/, ""))}</li>
              ))}
            </ul>
          )
        }

        return <p key={key}>{inline(block)}</p>
      })}
    </>
  )
}

/** **bold** only. Everything else stays literal, which is the safe default. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const key = `${index}-${part}`
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    return <span key={key}>{part}</span>
  })
}
