/**
 * The six scenes for Echt oder Fake?
 *
 * These are drawn here rather than generated, and that is a deliberate,
 * documented limitation rather than an oversight. The gateway speaks a
 * text-completion protocol, so live image generation is not something this
 * app can reach today; and shipping photographs would mean either bundling
 * stock images of real people or fetching from the network, which the app's
 * own rules forbid.
 *
 * What survives the compromise is the actual lesson: the taxonomy of tells —
 * hands, text, physics, edges, too-perfect — and the habit of looking for
 * them before believing an image. The tells here are deliberately clearer
 * than they would be in the wild, and the parent note says so, and points at
 * the better exercise: doing this together on her own feed.
 *
 * Every colour is a token. The scenes read in both schemes because they are
 * drawn from the same semantic colours as the rest of the app.
 */

type SceneProps = { className?: string }

const box = { viewBox: "0 0 240 160", role: "img" as const, className: "scene" }

/** Six fingers. The classic tell, and the first one anyone learns. */
function Hand({ className }: SceneProps) {
  return (
    <svg {...box} className={className ?? box.className} aria-label="Eine Hand hält eine Tasse">
      <rect width="240" height="160" fill="var(--color-surface)" />
      <rect
        x="150"
        y="70"
        width="52"
        height="56"
        rx="6"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="3"
      />
      <path
        d="M202 84h14a10 10 0 0 1 0 20h-14"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="3"
      />
      <path
        d="M52 128c-6-22-4-46 2-64 4-12 18-10 18 2v22"
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="3"
      />
      {[0, 1, 2, 3, 4].map((finger) => (
        <rect
          key={finger}
          x={72 + finger * 15}
          y={54 - (finger % 2) * 8}
          width="11"
          height={52 + (finger % 2) * 8}
          rx="5"
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth="3"
        />
      ))}
      <rect
        x="60"
        y="96"
        width="88"
        height="32"
        rx="12"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeWidth="3"
      />
    </svg>
  )
}

/** Letter-shaped marks that spell nothing. */
function Schild({ className }: SceneProps) {
  return (
    <svg
      {...box}
      className={className ?? box.className}
      aria-label="Ein Ladenschild in einer Strasse"
    >
      <rect width="240" height="160" fill="var(--color-surface)" />
      <rect
        x="16"
        y="24"
        width="208"
        height="112"
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="2"
      />
      <rect
        x="44"
        y="46"
        width="152"
        height="46"
        rx="4"
        fill="var(--color-bg)"
        stroke="var(--color-fg)"
        strokeWidth="3"
      />
      <g stroke="var(--color-fg)" strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M58 78V60m0 0 8 12 8-12v18" />
        <path d="M86 78V60h10a6 6 0 0 1 0 11h-8" />
        <path d="M112 60v18m0-18h9m-9 9h7" />
        <path d="M132 78c8 0 10-18 2-18s-6 18 2 18" />
        <path d="M152 60v18h10" />
        <path d="M172 78V60l10 18V60" />
      </g>
      <rect
        x="88"
        y="104"
        width="64"
        height="32"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="2"
      />
    </svg>
  )
}

/** One sun, two shadow directions. */
function Schatten({ className }: SceneProps) {
  return (
    <svg {...box} className={className ?? box.className} aria-label="Zwei Bäume auf einer Wiese">
      <rect width="240" height="160" fill="var(--color-surface)" />
      <circle cx="196" cy="30" r="14" fill="none" stroke="var(--color-brass)" strokeWidth="3" />
      <line x1="0" y1="120" x2="240" y2="120" stroke="var(--color-border)" strokeWidth="2" />
      <ellipse
        cx="106"
        cy="122"
        rx="46"
        ry="7"
        fill="var(--color-muted)"
        opacity="0.45"
        transform="translate(-38 0)"
      />
      <ellipse
        cx="176"
        cy="122"
        rx="40"
        ry="7"
        fill="var(--color-muted)"
        opacity="0.45"
        transform="translate(34 0)"
      />
      <g stroke="var(--color-fg)" strokeWidth="3" fill="none">
        <path d="M66 120V86" />
        <circle cx="66" cy="70" r="22" />
        <path d="M176 120V90" />
        <circle cx="176" cy="74" r="18" />
      </g>
    </svg>
  )
}

/** Real: messy, one light direction, nothing quite square. */
function Kueche({ className }: SceneProps) {
  return (
    <svg {...box} className={className ?? box.className} aria-label="Ein Frühstückstisch">
      <rect width="240" height="160" fill="var(--color-surface)" />
      <rect x="0" y="104" width="240" height="56" fill="var(--color-bg)" />
      <ellipse cx="86" cy="118" rx="34" ry="6" fill="var(--color-muted)" opacity="0.35" />
      <ellipse cx="168" cy="116" rx="22" ry="5" fill="var(--color-muted)" opacity="0.35" />
      <g transform="rotate(-4 78 92)">
        <rect
          x="52"
          y="66"
          width="52"
          height="42"
          rx="5"
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth="3"
        />
        <path
          d="M104 78h12a9 9 0 0 1 0 18h-12"
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth="3"
        />
      </g>
      <circle cx="168" cy="98" r="20" fill="none" stroke="var(--color-fg)" strokeWidth="3" />
      <path d="M158 98h20" stroke="var(--color-brass)" strokeWidth="3" />
      <g fill="var(--color-muted)">
        <circle cx="128" cy="126" r="2" />
        <circle cx="139" cy="131" r="1.5" />
        <circle cx="118" cy="133" r="1.8" />
        <circle cx="197" cy="124" r="2.2" />
        <circle cx="205" cy="132" r="1.4" />
      </g>
    </svg>
  )
}

/** Mismatched earrings, poreless skin. */
function Portrait({ className }: SceneProps) {
  return (
    <svg {...box} className={className ?? box.className} aria-label="Ein Porträt vor einer Wand">
      <rect width="240" height="160" fill="var(--color-surface)" />
      <rect x="0" y="0" width="240" height="160" fill="var(--color-bg)" opacity="0.4" />
      <ellipse
        cx="120"
        cy="76"
        rx="40"
        ry="50"
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="3"
      />
      <path
        d="M96 66c4-4 10-4 14 0M130 66c4-4 10-4 14 0"
        stroke="var(--color-fg)"
        strokeWidth="3"
        fill="none"
      />
      <path d="M108 100c8 6 16 6 24 0" stroke="var(--color-fg)" strokeWidth="3" fill="none" />
      <path
        d="M100 126c-14 6-24 18-26 34h92c-2-16-12-28-26-34"
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="3"
      />
      <circle cx="80" cy="86" r="7" fill="none" stroke="var(--color-brass)" strokeWidth="3" />
      <rect
        x="155"
        y="82"
        width="7"
        height="14"
        fill="none"
        stroke="var(--color-brass)"
        strokeWidth="3"
      />
    </svg>
  )
}

/** Real: reflections match, ropes sag, one hull is scuffed. */
function Hafen({ className }: SceneProps) {
  return (
    <svg {...box} className={className ?? box.className} aria-label="Boote im Hafen">
      <rect width="240" height="160" fill="var(--color-surface)" />
      <rect x="0" y="96" width="240" height="64" fill="var(--color-bg)" />
      <g stroke="var(--color-fg)" strokeWidth="3" fill="none">
        <path d="M40 96h68l-10 18H50z" />
        <path d="M74 96V50l26 30" />
        <path d="M140 96h58l-8 15h-42z" />
        <path d="M168 96V60l20 22" />
      </g>
      <path d="M108 78q18 12 32 4" stroke="var(--color-muted)" strokeWidth="2" fill="none" />
      <path d="M96 108h6" stroke="var(--color-danger)" strokeWidth="3" />
      <g stroke="var(--color-muted)" strokeWidth="2" opacity="0.5" fill="none">
        <path d="M50 118h48l-8 14H58z" />
        <path d="M74 132v20" />
        <path d="M148 114h42l-6 12h-30z" />
        <path d="M168 126v18" />
      </g>
      <path d="M0 140h240" stroke="var(--color-border)" strokeWidth="2" />
    </svg>
  )
}

const SCENES: Record<string, (props: SceneProps) => React.JSX.Element> = {
  hand: Hand,
  schild: Schild,
  schatten: Schatten,
  kueche: Kueche,
  portrait: Portrait,
  hafen: Hafen,
}

export function Scene({ name }: { name: string }) {
  const Drawn = SCENES[name]
  if (!Drawn) return <div className="scene" />
  return <Drawn />
}
