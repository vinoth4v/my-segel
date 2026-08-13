/**
 * The pictures.
 *
 * Drawn in code rather than generated: no image model is reachable through
 * the gateway, and the app is forbidden from fetching anything at runtime.
 * That constraint turned out to be a feature — an SVG built from design
 * tokens re-colours itself in every theme and in dark mode, which a PNG
 * never would.
 *
 * Bolder than the rest of the app on purpose. The chrome stays a harbour
 * chart — thin lines, brass, restraint — while these are big, saturated and
 * occasionally moving, because a ten-year-old meeting a wall of German prose
 * closes the tab. The line the design direction actually draws is against
 * *cartoon mascots and Fisher-Price primaries*, not against colour, so these
 * push scale and hue while keeping the nautical vocabulary: buoys, flags,
 * charts, deep water.
 *
 * Motion is CSS in globals.css and respects prefers-reduced-motion.
 */

import { type ArtName, isArtName } from "@/segel/art"

type ArtProps = { className?: string }

const FRAME = { viewBox: "0 0 320 180", className: "art", role: "img" as const }

/** Scattered positions, as tuples so destructuring stays type-checked. */
type Spot = readonly [number, number]

const PAGE_SPOTS: readonly Spot[] = [
  [30, 44],
  [58, 28],
  [86, 50],
  [114, 32],
  [24, 74],
  [56, 66],
  [90, 84],
]

const TOOL_SPOTS: readonly Spot[] = [
  [222, 44],
  [258, 62],
  [232, 92],
]

const LEAK_SPOTS: readonly Spot[] = [
  [44, 76],
  [252, 90],
  [40, 112],
]

/* ------------------------------------------------------- shared furniture */

/** Layered sea, used as the ground for most of the voyage art. */
function Waves({ y = 132 }: { y?: number }) {
  return (
    <g className="art-waves">
      <path d={`M0 ${y}q40-12 80 0t80 0 80 0 80 0V180H0Z`} fill="var(--color-sea)" opacity="0.35" />
      <path
        d={`M0 ${y + 14}q40-12 80 0t80 0 80 0 80 0V180H0Z`}
        fill="var(--color-sea)"
        opacity="0.6"
      />
    </g>
  )
}

function Sky() {
  return <rect width="320" height="180" fill="var(--color-surface)" />
}

/* --------------------------------------------------------- voyage artwork */

/** 1 — a machine that guesses the next word. */
function WasIstDasDing() {
  const tiles = ["Das", "Meer", "ist", "…"]
  return (
    <svg {...FRAME} aria-label="Eine Maschine, die das nächste Wort errät">
      <Sky />
      <Waves />
      <rect x="96" y="38" width="128" height="76" rx="14" fill="var(--color-sea)" />
      <rect x="110" y="52" width="100" height="30" rx="8" fill="var(--color-surface)" />
      {tiles.map((word, index) => (
        <text
          key={word}
          x={120 + index * 24}
          y="72"
          fontSize="11"
          fill="var(--color-fg)"
          fontFamily="var(--font-family-display)"
        >
          {word}
        </text>
      ))}
      <circle className="art-pulse" cx="196" cy="97" r="9" fill="var(--color-sun)" />
      <circle cx="124" cy="97" r="5" fill="var(--color-surface)" opacity="0.7" />
      <circle cx="140" cy="97" r="5" fill="var(--color-surface)" opacity="0.5" />
      <circle cx="156" cy="97" r="5" fill="var(--color-surface)" opacity="0.3" />
      <path d="M160 38V22" stroke="var(--color-brass)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="160" cy="18" r="7" fill="var(--color-brass)" />
    </svg>
  )
}

/** 2 — the hunt: a net under a confident wrong answer. */
function DieJagd() {
  return (
    <svg {...FRAME} aria-label="Eine Lupe über einer falschen Antwort">
      <Sky />
      <Waves />
      <rect x="34" y="40" width="150" height="58" rx="12" fill="var(--color-coral)" opacity="0.9" />
      <rect
        x="48"
        y="56"
        width="104"
        height="7"
        rx="3"
        fill="var(--color-surface)"
        opacity="0.85"
      />
      <rect x="48" y="70" width="82" height="7" rx="3" fill="var(--color-surface)" opacity="0.6" />
      <rect x="48" y="84" width="60" height="7" rx="3" fill="var(--color-surface)" opacity="0.4" />
      <g className="art-sway" style={{ transformOrigin: "232px 46px" }}>
        <circle
          cx="222"
          cy="76"
          r="40"
          fill="var(--color-sun)"
          fillOpacity="0.18"
          stroke="var(--color-brass)"
          strokeWidth="7"
        />
        <path
          d="M250 104l26 26"
          stroke="var(--color-brass)"
          strokeWidth="11"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M205 76l12 13 22-26"
        stroke="var(--color-coral)"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 3 — three buoys, three different answers. */
function DerZoo() {
  const buoys = [
    { x: 68, colour: "var(--color-sea)", h: 44, label: "A" },
    { x: 160, colour: "var(--color-coral)", h: 60, label: "B" },
    { x: 252, colour: "var(--color-success)", h: 34, label: "C" },
  ]
  return (
    <svg {...FRAME} aria-label="Drei verschiedene Bojen nebeneinander">
      <Sky />
      {buoys.map((buoy, index) => (
        <g
          key={buoy.label}
          className="art-bob"
          style={{ animationDelay: `${index * 0.45}s`, transformOrigin: `${buoy.x}px 130px` }}
        >
          <rect
            x={buoy.x - 22}
            y={128 - buoy.h}
            width="44"
            height={buoy.h}
            rx="20"
            fill={buoy.colour}
          />
          <rect
            x={buoy.x - 22}
            y={120 - buoy.h / 2}
            width="44"
            height="10"
            fill="var(--color-surface)"
            opacity="0.8"
          />
          <text
            x={buoy.x}
            y={140 - buoy.h}
            fontSize="15"
            textAnchor="middle"
            fill="var(--color-surface)"
            fontFamily="var(--font-family-display)"
            fontWeight="600"
          >
            {buoy.label}
          </text>
          <path
            d={`M${buoy.x} ${128 - buoy.h}V${112 - buoy.h}`}
            stroke="var(--color-brass)"
            strokeWidth="3"
          />
        </g>
      ))}
      <Waves y={126} />
    </svg>
  )
}

/** 4 — the lever bench: rough words in, sharp words out. */
function DasPromptLabor() {
  return (
    <svg {...FRAME} aria-label="Vier Hebel, die aus einem Satz einen besseren machen">
      <Sky />
      <rect x="18" y="52" width="94" height="76" rx="12" fill="var(--color-muted)" opacity="0.25" />
      <rect
        x="208"
        y="42"
        width="94"
        height="96"
        rx="12"
        fill="var(--color-success)"
        opacity="0.3"
      />
      {[0, 1, 2].map((line) => (
        <rect
          key={`a${line}`}
          x="32"
          y={70 + line * 16}
          width={62 - line * 14}
          height="7"
          rx="3"
          fill="var(--color-muted)"
        />
      ))}
      {[0, 1, 2, 3].map((line) => (
        <rect
          key={`b${line}`}
          x="222"
          y={60 + line * 16}
          width={66 - line * 6}
          height="7"
          rx="3"
          fill="var(--color-success)"
        />
      ))}
      {[0, 1, 2, 3].map((lever) => (
        <g key={lever}>
          <rect
            x={128 + lever * 16}
            y="66"
            width="8"
            height="48"
            rx="4"
            fill="var(--color-border)"
          />
          <circle
            className="art-pulse"
            cx={132 + lever * 16}
            cy={78 + (lever % 2) * 22}
            r="8"
            fill="var(--color-accent)"
            style={{ animationDelay: `${lever * 0.3}s` }}
          />
        </g>
      ))}
      <path
        d="M112 90h84"
        stroke="var(--color-brass)"
        strokeWidth="4"
        strokeDasharray="7 7"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 5 — the workbench, with the thing she built glowing on it. */
function DieWerkstatt() {
  return (
    <svg {...FRAME} aria-label="Eine Werkbank mit einem selbstgebauten Ding">
      <Sky />
      <rect
        x="30"
        y="118"
        width="260"
        height="14"
        rx="5"
        fill="var(--color-brass)"
        opacity="0.55"
      />
      <rect x="52" y="126" width="12" height="34" fill="var(--color-brass)" opacity="0.4" />
      <rect x="256" y="126" width="12" height="34" fill="var(--color-brass)" opacity="0.4" />
      <rect x="104" y="42" width="112" height="76" rx="12" fill="var(--color-sea)" />
      <rect x="116" y="56" width="88" height="34" rx="6" fill="var(--color-surface)" />
      <circle className="art-pulse" cx="160" cy="73" r="12" fill="var(--color-sun)" />
      <rect x="126" y="98" width="30" height="12" rx="6" fill="var(--color-accent)" />
      <rect x="164" y="98" width="30" height="12" rx="6" fill="var(--color-coral)" />
      <path
        d="M96 34l10 10M224 34l-10 10M160 26v12"
        stroke="var(--color-sun)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 6 — real or generated: a picture splitting apart under a lens. */
function EchtOderFake() {
  return (
    <svg {...FRAME} aria-label="Ein Bild, halb echt, halb erzeugt">
      <Sky />
      <rect
        x="42"
        y="34"
        width="110"
        height="112"
        rx="10"
        fill="var(--color-success)"
        opacity="0.75"
      />
      <circle cx="76" cy="66" r="13" fill="var(--color-sun)" />
      <path d="M42 118l38-32 34 28 30-22v54H42Z" fill="var(--color-sea)" opacity="0.85" />
      <rect
        x="168"
        y="34"
        width="110"
        height="112"
        rx="10"
        fill="var(--color-coral)"
        opacity="0.35"
      />
      {[0, 1, 2, 3, 4, 5].map((row) =>
        [0, 1, 2, 3, 4, 5].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={176 + col * 17}
            y={42 + row * 17}
            width="14"
            height="14"
            rx="3"
            fill="var(--color-coral)"
            opacity={0.25 + ((row + col) % 4) * 0.18}
          />
        )),
      )}
      <path d="M160 26v128" stroke="var(--color-brass)" strokeWidth="4" strokeDasharray="8 6" />
    </svg>
  )
}

/** 7 — where it all came from: a sea of pages pouring into the machine. */
function Trainingsdaten() {
  return (
    <svg {...FRAME} aria-label="Ein Berg aus Seiten, der in eine Maschine fliesst">
      <Sky />
      <Waves />
      {PAGE_SPOTS.map(([x, y], index) => (
        <g key={`${x}-${y}`} className="art-drift" style={{ animationDelay: `${index * 0.5}s` }}>
          <rect x={x} y={y} width="26" height="20" rx="3" fill="var(--color-sun)" opacity="0.9" />
          <rect x={x + 4} y={y + 5} width="18" height="3" rx="1.5" fill="var(--color-surface)" />
          <rect x={x + 4} y={y + 11} width="12" height="3" rx="1.5" fill="var(--color-surface)" />
        </g>
      ))}
      <path d="M140 66l44 22-44 22Z" fill="var(--color-brass)" opacity="0.55" />
      <rect x="196" y="52" width="94" height="72" rx="14" fill="var(--color-sea)" />
      <circle
        className="art-pulse"
        cx="243"
        cy="88"
        r="18"
        fill="var(--color-surface)"
        opacity="0.9"
      />
      <circle cx="243" cy="88" r="8" fill="var(--color-sun)" />
    </svg>
  )
}

/** 8 — who is missing: the same crowd, with holes in it. */
function Verzerrung() {
  const people = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <svg {...FRAME} aria-label="Eine Reihe von Figuren, bei der einige fehlen">
      <Sky />
      <Waves y={140} />
      {people.map((index) => {
        const missing = index === 2 || index === 5 || index === 6
        const x = 34 + index * 34
        return (
          <g key={index} opacity={missing ? 0.28 : 1}>
            <circle
              cx={x}
              cy="62"
              r="13"
              fill={missing ? "none" : "var(--color-sea)"}
              stroke={missing ? "var(--color-muted)" : "none"}
              strokeWidth="3"
              strokeDasharray={missing ? "5 4" : undefined}
            />
            <path
              d={`M${x - 16} 122c0-18 7-30 16-30s16 12 16 30Z`}
              fill={missing ? "none" : "var(--color-sea)"}
              stroke={missing ? "var(--color-muted)" : "none"}
              strokeWidth="3"
              strokeDasharray={missing ? "5 4" : undefined}
            />
          </g>
        )
      })}
      <path
        d="M18 34h284"
        stroke="var(--color-brass)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  )
}

/** 9 — whose is it: a painting, a copy, and a signature. */
function Urheberrecht() {
  return (
    <svg {...FRAME} aria-label="Ein Bild und seine Kopie, daneben eine Unterschrift">
      <Sky />
      <rect x="30" y="34" width="104" height="96" rx="8" fill="var(--color-coral)" opacity="0.85" />
      <circle cx="62" cy="64" r="12" fill="var(--color-sun)" />
      <path d="M30 116l32-28 28 22 24-18v38H30Z" fill="var(--color-surface)" opacity="0.55" />
      <rect
        x="186"
        y="46"
        width="104"
        height="96"
        rx="8"
        fill="var(--color-coral)"
        opacity="0.4"
        stroke="var(--color-muted)"
        strokeWidth="3"
        strokeDasharray="8 6"
      />
      <circle cx="218" cy="76" r="12" fill="var(--color-sun)" opacity="0.5" />
      <path d="M186 128l32-28 28 22 24-18v38h-84Z" fill="var(--color-surface)" opacity="0.3" />
      <path
        d="M142 92q14-14 28 0t28 0"
        stroke="var(--color-brass)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M46 148q16-12 30 0t30-4"
        stroke="var(--color-brass)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 10 — what it may do by itself: an arm reaching for tools. */
function Agenten() {
  return (
    <svg {...FRAME} aria-label="Ein Roboterarm, der nach Werkzeugen greift">
      <Sky />
      <rect x="20" y="120" width="280" height="12" rx="5" fill="var(--color-brass)" opacity="0.5" />
      <rect x="28" y="46" width="76" height="68" rx="12" fill="var(--color-sea)" />
      <circle cx="52" cy="72" r="7" fill="var(--color-surface)" />
      <circle cx="80" cy="72" r="7" fill="var(--color-surface)" />
      <path d="M50 94h32" stroke="var(--color-surface)" strokeWidth="5" strokeLinecap="round" />
      <g className="art-reach" style={{ transformOrigin: "104px 80px" }}>
        <path
          d="M104 80h56l26-22"
          stroke="var(--color-accent)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="190" cy="56" r="11" fill="var(--color-accent)" />
      </g>
      {TOOL_SPOTS.map(([x, y], index) => (
        <g key={`${x}-${y}`}>
          <rect
            x={x}
            y={y}
            width="34"
            height="26"
            rx="6"
            fill="var(--color-sun)"
            opacity={0.9 - index * 0.15}
          />
          <path
            d={`M${x + 9} ${y + 13}h16`}
            stroke="var(--color-surface)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  )
}

/** 11 — what it knows about you: a case, locked. */
function Privatsphaere() {
  return (
    <svg {...FRAME} aria-label="Ein verschlossener Koffer mit persönlichen Sachen">
      <Sky />
      <Waves y={142} />
      <rect x="86" y="58" width="148" height="82" rx="14" fill="var(--color-sea)" />
      <path
        d="M132 58V42a28 28 0 0 1 56 0v16"
        stroke="var(--color-brass)"
        strokeWidth="9"
        fill="none"
      />
      <circle className="art-pulse" cx="160" cy="96" r="16" fill="var(--color-surface)" />
      <rect x="155" y="96" width="10" height="20" rx="4" fill="var(--color-surface)" />
      <circle cx="160" cy="96" r="7" fill="var(--color-sea)" />
      {LEAK_SPOTS.map(([x, y], index) => (
        <g key={`${x}-${y}`} className="art-drift" style={{ animationDelay: `${index * 0.7}s` }}>
          <rect x={x} y={y} width="26" height="18" rx="4" fill="var(--color-coral)" opacity="0.8" />
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------- the lookup */

// Keyed by ArtName so a drawing cannot be added here without being declared
// in segel/art.ts, which is what the curriculum is checked against.
const VOYAGE_ART: Record<ArtName, () => React.JSX.Element> = {
  "was-ist-das-ding": WasIstDasDing,
  "die-jagd": DieJagd,
  "der-zoo": DerZoo,
  "das-prompt-labor": DasPromptLabor,
  "die-werkstatt": DieWerkstatt,
  "echt-oder-fake": EchtOderFake,
  trainingsdaten: Trainingsdaten,
  verzerrung: Verzerrung,
  urheberrecht: Urheberrecht,
  agenten: Agenten,
  privatsphaere: Privatsphaere,
}

/**
 * The header picture for a voyage.
 *
 * Falls back to nothing rather than to a placeholder: a missing drawing
 * should look like a plain page, not like a broken image.
 */
export function VoyageArt({ name, className }: { name?: string } & ArtProps) {
  if (!name || !isArtName(name)) return null
  const Drawn = VOYAGE_ART[name]
  return (
    <div className={className ?? "art-frame"}>
      <Drawn />
    </div>
  )
}

/* -------------------------------------------------------- station badges */

/**
 * A small bold badge per station type.
 *
 * Carries the same colour coding as the voyage art, so a station type is
 * recognisable before its name is read — which is most of the point for a
 * reader who is fluent but not fast.
 */
const STATION_ART: Record<string, { fill: string; glyph: React.JSX.Element }> = {
  talk: {
    fill: "var(--color-sea)",
    glyph: <path d="M10 26q0-14 14-14h16q14 0 14 14t-14 14H28l-10 8v-8q-8-2-8-14Z" />,
  },
  jagd: {
    fill: "var(--color-coral)",
    glyph: (
      <>
        <circle cx="28" cy="26" r="13" fill="none" strokeWidth="6" stroke="currentColor" />
        <path d="M38 36l12 12" strokeWidth="7" strokeLinecap="round" stroke="currentColor" />
      </>
    ),
  },
  zoo: {
    fill: "var(--color-success)",
    glyph: (
      <>
        <rect x="10" y="24" width="12" height="24" rx="6" />
        <rect x="28" y="14" width="12" height="34" rx="6" />
        <rect x="46" y="30" width="12" height="18" rx="6" />
      </>
    ),
  },
  labor: {
    fill: "var(--color-accent)",
    glyph: (
      <>
        <rect x="12" y="14" width="8" height="34" rx="4" />
        <circle cx="16" cy="24" r="7" />
        <rect x="34" y="14" width="8" height="34" rx="4" />
        <circle cx="38" cy="38" r="7" />
      </>
    ),
  },
  werkstatt: {
    // A hammer, as solid geometry. The previous glyph was an outline path
    // drawn for a stroke and then filled, which rendered as a blob — these
    // are all filled, so every glyph has to read as a silhouette.
    fill: "var(--color-sun)",
    glyph: (
      <>
        <rect x="14" y="12" width="34" height="12" rx="4" />
        <rect x="26" y="22" width="10" height="28" rx="3" />
      </>
    ),
  },
  echt: {
    fill: "var(--color-coral)",
    glyph: (
      <>
        <rect x="10" y="16" width="20" height="32" rx="4" />
        <rect x="36" y="16" width="20" height="32" rx="4" opacity="0.45" />
      </>
    ),
  },
  quiz: {
    fill: "var(--color-brass)",
    glyph: (
      <text
        x="34"
        y="46"
        fontSize="46"
        textAnchor="middle"
        fontFamily="var(--font-family-display)"
        fontWeight="600"
      >
        ?
      </text>
    ),
  },
}

export function StationBadge({ type }: { type: string }) {
  const art = STATION_ART[type]
  if (!art) return null
  return (
    <svg
      className="station-badge"
      viewBox="0 0 68 60"
      role="img"
      aria-hidden="true"
      style={{ color: art.fill }}
      fill={art.fill}
    >
      {art.glyph}
    </svg>
  )
}
