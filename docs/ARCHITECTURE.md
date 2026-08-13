# my-segel — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

A guided AI-literacy app for one ten-year-old and her father, run as a
six-week course. The thing being taught is scepticism before capability: that
a language model predicts plausible text rather than knowing anything, that it
sounds equally certain either way, and that the reader is the one who checks.

The app is the curriculum's delivery mechanism *and* its enforcement. A PDF
curriculum decays after week two; a chat box teaches that AI is an oracle.
Every conversation here happens inside a lesson with a scoped system prompt,
and the app refuses homework rather than trusting her not to ask.

## Domain model

**Segler** — the learner. One of her. She does not have her own account; see
Decisions.

**Kapitän** — the parent. Same credential, different view, second lock.

**Voyage** — one week. Six of them, ordered, and the order is load-bearing:
Die Jagd (2) runs before the capability voyages (3–5) so scepticism is
installed before she is shown what the thing can do.

**Station** — one activity inside a voyage, of seven kinds: `talk`, `jagd`,
`zoo`, `labor`, `werkstatt`, `echt`, `quiz`. The kind determines which
component renders it and which model answers it.

**Run** — one visit to one station. The unit a transcript hangs off, because
"what did she do on Tuesday" is a question about stations, not messages. A
refresh within three hours resumes the same run rather than splitting the
conversation.

**Catch** — a moment she noticed a model was wrong, with her reason for
thinking so. The app's unit of success, and the thing the brass stamp marks.

**Artifact** — a thing she built, as an ordered list of versions, each stored
with the sentence that produced it.

## Data model

All in migration `0001_segel`, alongside the template's `audit_log` from
`0000_audit_log`.

| Table | What it holds | Why it is shaped that way |
|---|---|---|
| `station_run` | one visit to one station | `completed_at` as a timestamp rather than a flag, so "started but abandoned" is distinguishable from "never opened" — that is what makes "continue where you left off" land correctly |
| `message` | every turn, hers and the model's | includes turns a filter stopped, with `blocked` and `block_reason`. The filter hides those from her, not from the parent, and "what did it try to say" is exactly the question a parent has |
| `logbuch_entry` | catches, rankings, builds, quiz results | `score` is 1 for a catch she found unprompted, which is the metric the whole course is measured on. `quote` keeps the model's claim verbatim so a catch is re-readable in six weeks |
| `artifact` / `artifact_version` | the Galerie | the `prompt` column on each version is the point of the table, not metadata on it — scrubbing back through versions to see her own descriptions sharpen is the lesson of Voyage 5 |
| `escalation` | each time a free model failed and a paid one finished | "zero surprise costs" is a promise about money, and a promise about money is only keepable if the spending is countable |
| `voyage_progress` | one row per voyage started | unique on `(learner, voyage_slug)`, so re-entering a voyage does not reset the date she first sailed it |
| `session_window` | server-side time accounting | in the database, not a cookie, precisely because the child must not be able to clear it |
| `setting` | session cap, daily cap, kill switch | three keys read as a group. Anything past a handful should become real columns |

Every Segel table carries a `learner` column defaulting to `'segler'`, and
every query filters on it. There is one learner, so today it is a constant.
It is kept because it is the row-ownership pattern: the day a second child
exists, that is a real user store plus a new value in this column, rather than
an audit of every query in the app.

## Surfaces

Everything is behind the operator session (the template's proxy closes routes
by default). Nothing here is exempt.

| Route | What it is |
|---|---|
| `/` | the Logbuch — the ledger, the six voyages, what to do next. The home screen, not a subpage |
| `/fahrt/[slug]` | one voyage: intro, station list, debrief once complete |
| `/fahrt/[slug]/[station]` | the station player. Opens the run server-side and hands the id to the client component |
| `/galerie`, `/galerie/[id]` | her builds, and one build with its version trail |
| `/deck` | Kapitäns-Deck, behind a second password |
| `/deck/transkript/[runId]` | one station's full conversation, blocked turns included |
| `/login` | the one way in |
| `POST /api/station/turn` | one turn of `talk` or `jagd` — same code, different routing and brief |
| `POST /api/station/zoo` | three models in parallel, per-column deadlines |
| `POST /api/station/labor` | both halves of the prompt comparison, one model |
| `POST /api/station/werkstatt` | build or change an artifact, verify-then-accept |
| `GET /api/artifact/[id]/[version]` | serves one artifact for the sandboxed frame, with its own CSP header |

Server actions: filing a catch, filing a Logbuch entry, finishing a station,
and the deck's unlock/lock/settings.

**The browser never names a model.** It sends a run id and text; the server
looks up the run, finds the station, and the station's *type* decides the
route. This is not defensiveness about tampering — it is that the routing is
the curriculum, and a client that could name its own model could accidentally
send the hunt to a good one.

## External services

| Service | What for | Configured by |
|---|---|---|
| Kompass gateway | every model call, without exception | `KOMPASS_BASE_URL`, `KOMPASS_TOKEN` |
| Neon Postgres | all persistence | `DATABASE_URL` |
| Vercel | hosting | — |

Optional per-station model pins: `SEGEL_PIN_TALK`, `SEGEL_PIN_JAGD`,
`SEGEL_PIN_ZOO` (comma-separated trio), `SEGEL_PIN_LABOR`,
`SEGEL_PIN_WERKSTATT`, `SEGEL_PIN_GRADE`. All optional; unset means the station
uses a Kompass lane alias and the gateway routes.

Routing, and the reason for each:

| Station | Default | Why |
|---|---|---|
| `talk` | `kompass-fast` | child-facing open conversation; instruction-following on the safety prompt is the product |
| `jagd` | `kompass-simple` | **deliberately the weakest lane.** Weak-and-confident is the desired behaviour |
| `zoo` | three different lanes | roster variety is the lesson; the reveal reports what actually served each column, read off the gateway's header |
| `labor` | `kompass-simple`, one route used twice | must be identical on both sides or the comparison measures models instead of prompts |
| `werkstatt` | `kompass-agentic`, escalating | free code models fail often enough that a fallback is required |
| `quiz`, `echt` | `kompass-simple` | low stakes; the quiz in fact grades locally against the content |

Fallback: an error, a timeout past the station's deadline, or output the
station cannot use retries once on a different free lane, then escalates to
`kompass-hard`. **`jagd` never falls back** — a strong model rescuing the weak
one would delete the only lesson that station exists for.

## Decisions in force

**Neon and Drizzle, not Supabase.** The spec asked for Supabase. The template's
entire PR pipeline brands every pull request with a Neon branch, migrates it,
and points that PR's Vercel preview at it; the production build applies
migrations before serving. Swapping the database would strand two of the five
required checks and lose the migration story, in exchange for nothing — both
are free-tier Postgres. Supabase's RLS becomes server-side row ownership on the
`learner` column, which is the same pattern with one deployment and no second
authenticated role to enforce it against.

**Every model call goes through Kompass, including `talk`.** The spec routed
the child-facing conversation to Anthropic directly for instruction-following.
`AGENTS.md` forbids provider SDKs in app code without exception, and the reason
holds here: the gateway owns quota and cooldown across a chain of models, so a
rate-limited provider becomes a slightly different answer rather than a 429 in
front of a ten-year-old mid-sentence.

**Models are named as lanes, with pins as the exception.** The spec pinned
concrete models per station. Pinning in code means a deploy the day a model is
retired, and the roster is the gateway's business. So the defaults are lane
aliases and pins live in the environment — set only where the exact model is
pedagogy (`jagd`, `labor`) rather than preference.

**Two roles, one credential.** The template forbids a second user, and rightly:
a real second identity needs a real user store. So the Segler view is what the
session opens on, and the Kapitäns-Deck is behind a re-entry of the same
operator password, held as a signed cookie for thirty minutes. That is the
honest version of "she cannot read her transcripts back or turn the cap off" —
she does not have the password.

**`echt` ships drawn plates, not generated images.** There is no image endpoint
behind the gateway, so `flux-1-schnell` is unreachable. Rather than a station
that needs a service that does not exist, the plates are authored SVGs carrying
the exact mistakes an image model makes. They are presented as *Schaubilder*
and the question is "does this add up?" — asking whether an obvious line
drawing is a photograph would train her to detect drawings, which is not the
skill. Two of the six are sound, so answering "fake" every time loses. Swapping
in a real image lane means replacing `lib/plates.ts` and `components/
plate-art.tsx`; `plateIds` in the content does not change.

**Werkstatt verifies before it accepts.** A model reply is extracted, checked
for truncation, emptiness and network egress, and an unusable reply counts as a
*failed call* — so it falls through to the next model exactly like a timeout
would. The acceptance test is ten consecutive builds with no blank frame, and
"call the model and render the answer" does not pass it.

**The artifact frame is sandboxed without `allow-same-origin`, and served from
a route.** The sandbox gives it an opaque origin so it cannot touch this app's
DOM or cookies; the route lets the policy be a real CSP *header* rather than a
`<meta>` tag inside generated markup, which is advisory in a way a header is
not. `default-src 'none'` leaves her code nowhere to send anything.

**The quiz grades locally.** The spec routes grading to a small free model. For
a multiple-choice question whose answer is an integer in a JSON file, a model
call would be slower, less reliable, and would spend tokens reproducing a
comparison. The model-graded path is worth building when there are free-text
answers to grade; there are none yet.

**Blocked turns are stored, not dropped.** A filtered message is written to the
transcript with its original text and marked. It is withheld from her and from
the model's context — feeding it back would hand the model the personal data
the filter just stopped — and shown in full on the parent deck.

**The curriculum is JSON, and the tests are its compiler.** Six files in
`content/voyages/`, parsed against a Zod schema by `voyages.test.ts`, which
also asserts the things that are decisions rather than data: that Die Jagd
comes before the capability voyages, that the two-seater voyages are marked,
that station times fit inside the session cap.

**One thing animates.** The brass stamp landing on a catch. Nothing else, at
all. Restraint is what keeps an interface from reading as generated, and a page
where six things move teaches that none of them matter.

## Known gaps

- **German only.** The DE/EN toggle from the spec is not built. "Which
  language" is an unresolved open question, and authoring a second full
  curriculum on a guess is the expensive way to answer it.
- **No streaming.** Answers appear complete. Adds a few seconds of visible
  waiting per turn; the fan-out stations feel it most.
- **No voice input.** Slow typing is the main friction risk in Voyage 4.
  Whisper via the gateway would fix it, and remains an open question.
- **No small-model pass on the input filter.** The spec asked for regex *plus*
  a model check for personal data. Only the regex is built — it is synchronous
  and offline, which is what a check on the hot path should be, and a model
  pass would add a round trip to every message or run in parallel and let the
  data reach the answering model anyway. Worth revisiting with a measurement of
  what the regex misses.
- **The zoo's blind is a UI blind.** The model names ride along in the response
  and are withheld by the client until she ranks. Devtools would show them.
  Holding them back would cost a round trip at the one moment that should feel
  instant, against a child choosing to cheat at a game whose prize is her own
  opinion.
- **Plate balance is hand-maintained.** Four flawed, two sound. Adding plates
  means keeping roughly that ratio, which `plates.test.ts` checks loosely.
- **Migration `0001_segel` was hand-authored**, including its drizzle snapshot,
  because `pnpm` was unavailable in the agent runner that wrote it and
  `db:generate` could not run. The SQL and journal are what the migrator reads
  and are correct; the snapshot was written to match by hand. Worth running
  `pnpm db:generate` once on a real machine to confirm it produces no
  spurious diff before writing `0002`.
