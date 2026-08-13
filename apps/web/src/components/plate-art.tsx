import type { ReactNode } from "react"

/**
 * The drawings for the plates.
 *
 * Kept apart from lib/plates.ts so the curriculum facts stay unit-testable
 * without a JSX runtime, and so replacing these with real generated images
 * later is one file rather than a refactor.
 *
 * Every stroke uses a theme token rather than a literal colour, so the plates
 * come along with a theme change like everything else does.
 */

const INK = "var(--color-fg)"
const PAPER = "var(--color-surface)"
const LINE = "var(--color-border)"
const WARM = "var(--color-accent)"

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" role="img" aria-label={label}>
      <rect x="0" y="0" width="200" height="150" fill={PAPER} />
      {children}
    </svg>
  )
}

const ART: Record<string, (label: string) => ReactNode> = {
  haende: (label) => (
    <Frame label={label}>
      <path
        d="M60 70 L60 120 Q60 128 68 128 L104 128 Q112 128 112 120 L112 70 Z"
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M112 82 Q128 82 128 96 Q128 110 112 110" fill="none" stroke={INK} strokeWidth="2" />
      <path
        d="M96 70 Q92 52 100 44 L148 44 Q154 52 150 70 Z"
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      {[100, 110, 120, 130, 140].map((x) => (
        <path
          key={x}
          d={`M${x} 44 L${x} 24 Q${x + 4} 18 ${x + 8} 24 L${x + 8} 44`}
          fill="none"
          stroke={INK}
          strokeWidth="2"
        />
      ))}
      <path d="M96 66 L78 60 Q72 58 74 52" fill="none" stroke={INK} strokeWidth="2" />
    </Frame>
  ),

  hafenfoto: (label) => (
    <Frame label={label}>
      <circle cx="34" cy="28" r="10" fill="none" stroke={WARM} strokeWidth="2" />
      <line x1="0" y1="104" x2="200" y2="104" stroke={LINE} strokeWidth="2" />
      <rect x="118" y="96" width="70" height="8" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M130 104 L130 122 M176 104 L176 122" stroke={INK} strokeWidth="2" />
      <path d="M44 104 L112 104 L102 118 L54 118 Z" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M78 104 L78 40" stroke={INK} strokeWidth="2" />
      <path d="M78 46 L110 100 L78 100 Z" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M54 124 L102 124" stroke={INK} strokeWidth="2" opacity="0.3" />
      <path d="M78 128 L96 130" stroke={INK} strokeWidth="2" opacity="0.3" />
    </Frame>
  ),

  marktschild: (label) => (
    <Frame label={label}>
      <rect x="30" y="20" width="140" height="52" fill="none" stroke={INK} strokeWidth="2" />
      <text
        x="100"
        y="44"
        textAnchor="middle"
        fill={INK}
        fontSize="18"
        fontFamily="var(--font-family-display)"
      >
        BÄCKREEI
      </text>
      <text
        x="100"
        y="63"
        textAnchor="middle"
        fill={INK}
        fontSize="12"
        fontFamily="var(--font-family-display)"
      >
        FRSICH ROTT
      </text>
      <rect x="40" y="86" width="120" height="10" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M50 96 L50 132 M150 96 L150 132" stroke={INK} strokeWidth="2" />
      {[62, 82, 102, 122].map((x) => (
        <circle key={x} cx={x} cy="110" r="7" fill="none" stroke={INK} strokeWidth="2" />
      ))}
    </Frame>
  ),

  stuhl: (label) => (
    <Frame label={label}>
      <circle cx="26" cy="24" r="9" fill="none" stroke={WARM} strokeWidth="2" />
      <line x1="10" y1="126" x2="190" y2="126" stroke={LINE} strokeWidth="2" />
      <rect x="108" y="66" width="76" height="7" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M116 73 L116 126 M176 73 L176 126" stroke={INK} strokeWidth="2" />
      <path d="M116 126 L134 132 M176 126 L194 132" stroke={INK} strokeWidth="2" opacity="0.35" />
      <rect x="30" y="76" width="56" height="7" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M30 76 L30 34 M86 76 L86 50" stroke={INK} strokeWidth="2" />
      <path d="M30 40 L86 40" stroke={INK} strokeWidth="2" />
      <path
        d="M36 83 L36 126 M52 83 L52 126 M68 83 L68 126 M80 83 L80 126"
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M36 126 L54 132 M80 126 L98 132" stroke={INK} strokeWidth="2" opacity="0.35" />
    </Frame>
  ),

  schatten: (label) => (
    <Frame label={label}>
      <circle cx="168" cy="26" r="12" fill="none" stroke={WARM} strokeWidth="2" />
      <line x1="10" y1="112" x2="190" y2="112" stroke={LINE} strokeWidth="2" />
      <path d="M50 112 L50 82" stroke={INK} strokeWidth="3" />
      <circle cx="50" cy="68" r="18" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M50 112 L88 124 L50 118 Z" fill={INK} opacity="0.35" />
      <path d="M140 112 L140 82" stroke={INK} strokeWidth="3" />
      <circle cx="140" cy="68" r="18" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M140 112 L102 124 L140 118 Z" fill={INK} opacity="0.35" />
    </Frame>
  ),

  spiegelung: (label) => (
    <Frame label={label}>
      <rect x="104" y="22" width="76" height="96" fill="none" stroke={INK} strokeWidth="2" />
      <line x1="10" y1="118" x2="190" y2="118" stroke={LINE} strokeWidth="2" />
      <ellipse cx="52" cy="96" rx="22" ry="18" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="52" cy="66" r="14" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M40 56 L38 42 L50 52 M64 56 L66 42 L54 52" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M74 96 Q90 92 88 74" fill="none" stroke={INK} strokeWidth="2" />
      <ellipse cx="142" cy="96" rx="22" ry="18" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="142" cy="66" r="14" fill="none" stroke={INK} strokeWidth="2" />
      <path
        d="M130 60 Q118 66 126 78 M154 60 Q166 66 158 78"
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M164 92 L176 88" fill="none" stroke={INK} strokeWidth="2" />
    </Frame>
  ),
}

/** Falls back to the alt text alone, which is still a usable plate. */
export function PlateArt({ id, label }: { id: string; label: string }) {
  const draw = ART[id]
  if (!draw) return <p className="plate-fallback">{label}</p>
  return draw(label)
}
