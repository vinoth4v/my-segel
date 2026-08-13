# my-segel — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

A guided AI-literacy app for one 10-year-old and her father. Eleven weeks of
curriculum, in German, whose subject is that a language model is a confident
pattern-matcher that is frequently and plausibly wrong.

The pedagogy constrains the engineering in ways that look like bugs if you do
not know them. Two examples, both load-bearing: `jagd` runs on the *weakest*
lane because the failure is the lesson, and `labor` must run both halves of
its comparison on the *same* model or the station measures the wrong thing.
Neither would survive a well-meaning optimisation pass, which is why both are
covered by unit tests that say so.

## Domain model

- **Voyage** — one week. Six of them, numbered, each with an intro, two to
  four stations, and a debrief. Voyage 2 (Die Jagd) runs before the ones that
  teach capability, deliberately: skepticism is installed before usefulness.
- **Station** — one activity inside a voyage, of exactly one type:
  `talk`, `jagd`, `zoo`, `labor`, `werkstatt`, `echt`, `quiz`. The type
  decides which component renders it and which model serves it.
- **Catch** — she decided a model's answer was wrong and said why. The unit
  the whole app is judged on; a catch without her reason is not a catch.
- **Logbuch entry** — a catch, a ranking, a build, or a note. One stream,
  because to her it is one ledger.
- **Artifact** — a thing she built in the Werkstatt, plus every version, each
  keeping the sentence that produced it.
- **Segler / Kapitän** — the learner and the parent. Two *roles*, one
  account; see Decisions in force.

## Data model

All introduced by `0001_burly_tiger_shark.sql` except `audit_log`, which came
from the template in `0000_audit_log.sql`.

- **`audit_log`** — sign-ins and failed sign-ins, including failed unlocks of
  the parent deck. From the template, unchanged.
- **`transcript`** — every turn: her messages and the model's, plus which
  model was asked, which lane and concrete model answered, whether it was an
  escalation and why, and whether a filter replaced it. Append-only, with no
  delete path reachable from the child's surfaces.
- **`logbuch_entry`** — `kind` (catch/ranking/build/note), her `why`, and a
  `jsonb` payload for whatever the kind needs. One table rather than three
  because the home page interleaves them in time order, and because a new
  station type should not need a migration.
- **`station_progress`** — unique on (voyage, station); progress is a state,
  not a history. `completed_at` is only ever set, never cleared — finishing
  something is not something the app takes back from her.
- **`artifact`** / **`artifact_version`** — split so versions are never
  overwritten. The prompt is stored beside the HTML because scrubbing back
  through her own prompts is the pedagogical point of the Werkstatt, not an
  undo feature.
- **`app_setting`** — key/value for the caps and the kill switch. Defaults
  live in code, so an empty table is a working app with safe limits.
- **`usage_day`** — one row per day: active minutes, current sitting minutes,
  last-seen timestamp, call count. One row serves both the session cap and
  the daily cap, because a gap longer than the idle window starts a new
  sitting.

## Surfaces

Everything requires the operator's session — the proxy is closed by default
and nothing here is exempt beyond the template's own `/login` and `/api/auth`.

| Route | For |
|---|---|
| `/` | The Logbuch, and the home page. Deliberately the same thing. |
| `/reise/[voyageId]` | A voyage: intro, its stations, the debrief questions. |
| `/reise/[voyageId]/[stationId]` | One station; dispatches to a client component by type. |
| `/galerie`, `/galerie/[id]` | What she built, and the version scrubber. |
| `/deck` | Kapitäns-Deck. Behind a *second* password prompt. |
| `POST /api/station/chat` | `talk` and `jagd`. Filters, caps, transcript. |
| `POST /api/station/zoo` | Three models concurrently, `allSettled`. Never reveals which is which. |
| `POST /api/station/zoo/reveal` | Requires her ranking in the same request that returns the names. |
| `POST /api/station/labor` | Both prompts, one lane, in one request; verifies both halves were served by the same model. |
| `POST /api/station/werkstatt` | The build loop; creates or versions an artifact. |
| `POST /api/logbuch` | Files a catch. Requires her `why`. No cap check. |
| `POST /api/progress` | Start/complete, for stations that need no model. |
| `POST /api/artifact/[id]` | Set current version, mark "shown to someone". No delete. |

Every route that calls a model goes through `segel/guard.ts` first, which
checks the session and the caps. Routes that do *not* call a model — filing a
catch, recording progress — deliberately skip the cap check: hitting the limit
by filing a catch would punish exactly the behaviour the app exists to reward.

## External services

- **Kompass gateway** (`KOMPASS_BASE_URL`, `KOMPASS_TOKEN`) — every model
  call, server-side only. `src/kompass.ts` is the only thing that reads the
  token; `segel/router.ts` decides what to ask for.
- **Neon Postgres** (`DATABASE_URL`) — via Drizzle, migrations checked in.
- **Auth** (`AUTH_SECRET`, `WERFT_USER_EMAIL`, `WERFT_PASSWORD_HASH`) — the
  single operator gate, plus the HMAC that signs the parent-deck unlock.

Only the Werkstatt can cost money, and only when free models fail and it
escalates. Every escalation is written to the transcript and listed in the
Kapitäns-Deck, so the free-to-paid ratio is visible rather than drifting.

## Decisions in force

- **Neon, not Supabase.** The spec asked for Supabase; the template ships Neon
  with the whole preview-branch-per-PR pipeline already built around it, and
  `@supabase/supabase-js` is not a blessed dependency. Supabase's RLS with two
  roles buys nothing here because there is one database user and one gate.
  Same Postgres, one less decision to raise.
- **No `talk` route to Anthropic directly.** The spec routes `talk` to Haiku
  direct. `AGENTS.md` forbids any provider SDK or direct call from app code,
  without exception, so `talk` goes through the gateway on a lane. The
  underlying concern — that the one open child-facing conversation should not
  be served by something that ignores the safety prompt — is met by giving it
  a *lane* rather than a pin, so the gateway always has a working chain.
- **Lanes only. The gateway does not support pinned model names.** This was
  learned the hard way: an earlier version asked for names like
  `kompass:google/gemini-3.6-flash`. `GET /v1/models` returns *only* the six
  lane aliases, and an unknown name is not rejected — the gateway answers 200
  and quietly serves its default lane. The Modell-Zoo therefore got three
  answers from one model and revealed them under three invented names. Nothing
  caught it because nothing failed. The pedagogy is now expressed in lanes,
  which really do resolve to different models: `kompass-simple` for `jagd`,
  one fixed lane for both halves of `labor`, and a Zoo trio drawn from
  `fast`/`agentic`/`hard`/`longctx`.
- **`kompass-simple` is excluded from the Zoo roster.** It and `kompass-fast`
  both resolve to gpt-oss-120b today, so drawing both would put one model on
  the table twice under two letters — a quieter version of the same bug.
- **Model names shown to her come from `x-kompass-served-by`, never from a
  table.** A table drifts out of truth; the header is what actually answered.
  An unrecognised model is named from its own string rather than guessed, and
  a round that turns out to have been served by fewer than two distinct models
  says so instead of naming three.
- **One account, two locks.** `AGENTS.md` forbids adding a second user, and a
  real child/parent split needs a real user store. But the session in use is
  usually *hers*, and the deck holds transcripts, caps and the kill switch —
  so `/deck` requires re-entering the operator password, held as a
  30-minute HMAC cookie signed with `AUTH_SECRET`. No second user, no new
  table, and she still cannot raise her own time limit.
- **The caps fail closed.** If the database is unreachable, no model call
  happens. Proceeding would break two promises at once — the caps are
  enforced server-side, and every exchange is recorded — and would break them
  invisibly. Refusing is visibly broken, which is the better failure.
- **The Zoo reveal is enforced at the wire.** The browser is never told which
  model is behind A, B or C until it posts a ranking. A UI-only blind test is
  undone by a curious ten-year-old with a devtools window. The mapping lives
  only in the transcript rows the round wrote, each tagged with its letter and
  carrying the model that served it.
- **Illustrations are SVG built from design tokens, not images.** No image
  model is reachable through a text gateway and the app may not fetch
  anything, but the constraint pays: a token-built drawing re-colours itself
  in every theme and in dark mode, which a PNG never would. They are
  deliberately bolder than the chrome — the design direction rules out cartoon
  mascots and Fisher-Price primaries, not colour.
- **Grading is arithmetic, not a model.** The quiz has its answers in the
  content JSON and the prompt-strength meter counts levers. Both are instant,
  free and never wrong — and in an app about models being confidently wrong,
  a model marking her correct answer wrong would be an unusually poor joke.
  She is told the meter is arithmetic; that is its own small lesson.
- **The curriculum is data.** `content/voyages/*.json`, strict Zod schema,
  imported by name rather than read from the directory so a missing file is a
  build error. A week can be rewritten without touching a component.
- **The Werkstatt sandbox is `allow-scripts` and nothing else.** Adding
  `allow-same-origin` alongside it would silently void the whole sandbox. It
  is the easiest mistake available here, so it is written down at both call
  sites.
- **Markdown is rendered by a 40-line function, not a library.** No Markdown
  parser is on the blessed list, the content uses four constructs, and the
  renderer emits React elements rather than HTML — so a future voyage
  authored by a model cannot inject markup into her page.

## Known gaps

- **`echt` uses hand-drawn SVG scenes, not generated images.** The gateway
  speaks a text-completion protocol, so `flux-1-schnell` is not reachable
  through it, and fetching images is forbidden by the app's own rules. The
  tells taxonomy and the commit-then-reveal mechanic are intact; the pictures
  are illustrations with the flaws built in, and more obvious than real ones.
  The parent note admits this and points at the better exercise.
- **No streaming.** Replies arrive whole, so the Zoo waits for the slowest of
  three. The spec's "three models in under 8 seconds" is met by concurrency,
  not by progressive rendering.
- **No voice input.** The spec flags slow typing as the main friction risk in
  Voyage 4 and it is real. Whisper through the gateway would fix it.
- **The input filter is regex only.** The spec also wanted a small-model pass
  for personal data. Regex is instant, free and catches the obvious cases;
  the deeper protections are that the system prompt refuses to *collect*
  personal data and that the parent reads every transcript.
- **Session caps are charged per model call**, not by a heartbeat, so time
  spent reading without asking anything is not counted. Given the anti-metric
  is time in app, undercounting is the safer direction.
- **No station has yet received a real model reply.** The gateway token has
  been verified to work and its lanes probed directly with curl, but the app
  itself has only ever run locally with `KOMPASS_TOKEN` empty. Production has
  the credentials; the first real session is the first integration test.
- **The Zoo depends on lanes resolving to different models**, which is true
  today and is not guaranteed. If the gateway ever points several lanes at one
  model, the reveal will say so rather than lie — but the station loses its
  point until the roster recovers. Worth re-probing `/v1/models` and the
  served-by headers occasionally.
- **The `echt` scenes and the voyage illustrations are hand-drawn**, so adding
  a voyage means drawing one. That is a real cost per week and the reason
  `segel/art.ts` exists: a voyage naming a drawing that does not exist fails a
  test rather than rendering a bare heading.
