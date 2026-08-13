# my-segel — session log

One entry per build session, newest last. Append; never edit an existing
entry, for the same reason migrations are append-only — a corrected record of
what was decided is no longer a record.

Each entry answers: what was asked, what changed, what was decided and why,
what was rejected, and what is still open.

---

## Scaffolded

**Asked:** create the app.

**Changed:** scaffolded from werft-template — App Router, single-operator
auth, Neon via Drizzle, design tokens, the PR gates, and `@claude` wired to
the operator's Claude subscription.

**Decided:** nothing yet beyond the template's own choices, which are in
AGENTS.md.

**Open:** everything the app is actually for. See ARCHITECTURE.md, which is
still a set of empty headings until the first feature lands.

---

## Segel, built

**Asked:** build the app from the Segel Build Spec v1 — a six-week AI-literacy
course for one ten-year-old and her father, Kompass for the model roster.

**Changed:** the whole app. Curriculum as six JSON voyages validated by Zod;
`lib/router.ts` mapping station type to model; safety filters on input and
output; the Logbuch as the home screen with the brass stamp; all seven station
types playable; sandboxed Werkstatt artifacts with version history; the
Kapitäns-Deck with transcripts, catch chart, escalation log, caps and kill
switch; a `segel` theme (harbour navy, aged paper, signal orange, brass,
sea-glass) with two new tokens and a display face; migration `0001_segel`.

**Decided, and why:**

- *Neon and Drizzle, not the spec's Supabase.* The template's PR pipeline
  brands every PR with a Neon branch and applies migrations in the Vercel
  build. Swapping the database strands two of the five required checks and
  loses the migration story in exchange for nothing — both are free Postgres.
  RLS becomes server-side ownership on a `learner` column.
- *Every model call through Kompass, including `talk`.* The spec sent the
  child-facing conversation to Anthropic directly. AGENTS.md forbids provider
  SDKs without exception, and the gateway's quota handling is worth more here
  than a named model: a rate limit becomes a different answer rather than a 429
  in front of a child mid-sentence.
- *Lanes by default, pins in the environment.* Concrete model names in code are
  a deploy the day one is retired. Pins exist for the two places where the
  exact model is pedagogy — the weak model in `jagd`, one model on both sides
  of `labor` — and are read from env.
- *Two roles, one credential.* The template forbids a second user. The Segler
  view is what the session opens on; the deck is behind re-entry of the same
  password, held as a signed cookie for thirty minutes.
- *Werkstatt verifies before accepting.* An unrenderable reply counts as a
  failed call and falls through to the next model, which is what makes ten
  consecutive builds without a blank frame achievable at all.
- *The quiz grades locally.* Its answers are integers in a JSON file; a model
  call would be slower and less reliable at reproducing `===`.

**Rejected:**

- *`flux-1-schnell` for Echt oder Fake.* No image endpoint behind the gateway,
  so it is unreachable. Shipped authored SVG plates carrying the real tells
  instead, and reframed the question from "is this a photo" to "does this add
  up" — asking a child whether a line drawing is a photograph trains her to
  detect drawings, not to detect generation.
- *A DE/EN toggle.* Language was listed as an open question and it is still
  open. Authoring a second curriculum on a guess is the expensive way to find
  out. German throughout, with all lesson text in JSON so the answer is cheap
  to act on later.
- *A small-model pass on the input filter.* Regex only for now. Sequential
  would add a round trip to every message; parallel would let the personal data
  reach the answering model anyway, which is most of what the check is for.
- *Streaming.* Not built. Worth adding, and it will be felt most in the zoo.

**Open:**

- **`pnpm build` was never run.** `pnpm` is not installed on the agent runner
  and every route to installing it needed a permission this session did not
  have, so `build`, `test`, `typecheck` and `lint` are all unverified locally.
  The PR gates are the first real check. This is a straight violation of the
  "never end work on a red build" rule in the only sense available — the build
  was not run rather than run and ignored — and it is recorded here rather than
  glossed, because the next session should not assume these files ever
  compiled.
- Migration `0001_segel` and its snapshot were hand-authored for the same
  reason. The SQL and journal are what the migrator reads; run `pnpm
  db:generate` once on a real machine to confirm the snapshot produces no
  spurious diff before writing `0002`.
- The four open questions from the spec are all still open: language, whether
  she gets her own device, voice input, and per-child memory in v2.
