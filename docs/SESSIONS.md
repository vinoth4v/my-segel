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

## Built Segel from the spec

**Asked:** read the build plan in `/docs` and build the app.

**Changed:** the whole app, from the placeholder home page to all six
voyages. Curriculum authored as six validated JSON files; station router with
pinned models and a fallback ladder; safety filters, system prompt, session
and daily caps, kill switch; seven station components; Logbuch home page,
Galerie with version scrubber, Kapitäns-Deck behind a second password;
migration `0001` adding six tables; harbour-chart palette replacing the
template's zinc-and-blue default. 61 new unit tests, four e2e smoke tests.
Gates green: build exits 0, 177 tests pass, typecheck and lint clean.

**Decided, and why** — the ones a future session would otherwise reverse:

- *Phase 0 first, properly.* The spec says the content phase decides whether
  the app is good and everything else is plumbing. So the six voyages were
  written as real curriculum with real parent notes before any station
  component existed, rather than stubbed and backfilled.
- *Pins only where the model is the requirement.* `AGENTS.md` says lane
  aliases and never reimplement routing; the spec requires a weak model for
  `jagd` and one identical model across `labor`. Resolved by passing a pinned
  name through to the gateway verbatim — still not reimplementing lane
  selection — with every pin falling back to its lane. Both invariants have
  unit tests that explain themselves, because they are exactly the kind of
  thing a later optimisation would quietly undo.
- *Caps fail closed.* A model call with no reachable database would break the
  two promises made to the parent — caps enforced server-side, every exchange
  recorded — and break them silently. Refusing is visibly broken instead.
- *The Zoo reveal is enforced server-side.* The browser learns the model names
  only in the response to posting a ranking. A blind test undone by devtools
  is not a blind test.
- *One account, second lock on `/deck`.* Reconciles "never add a second user"
  with the fact that the session in use is usually the child's.

**Rejected:**

- *Supabase.* Spec asked for it; the template's Neon plus the existing
  preview-branch pipeline does the same job, `@supabase/supabase-js` is not
  blessed, and RLS with two roles buys nothing with one database user.
- *Calling Anthropic directly for `talk`.* The spec routes it to Haiku
  direct; `AGENTS.md` forbids that with no exception. Met the underlying
  concern by giving `talk` a lane rather than a pin.
- *A Markdown dependency.* Not blessed, and the content uses four constructs.
  Wrote a small renderer that emits React elements, which also means content
  can never inject markup.
- *A model grading the quiz or scoring prompt strength.* Slower, costs
  tokens, occasionally wrong — and absurd in this app specifically.
- *Live image generation for `echt`.* Not reachable through a text gateway,
  and fetching images is forbidden here. Shipped hand-drawn scenes with the
  tells built in, and said so in the parent note rather than pretending.

**Found the hard way:** Next expands `$NAME` inside local env files, so a
pasted scrypt hash (`scrypt$65536$8$1$…`) silently becomes a different string
and correct credentials are rejected with the deliberately unhelpful "not
accepted" message. Cost a confused detour during the browser walkthrough.
Now documented in `.env.example` and the README. Vercel's dashboard does not
expand, so production was never affected.

**Also fixed:** `pnpm lint` was already red on the pristine template — two
`noImportantStyles` errors on the reduced-motion block. The `!important` is
correct there (it must outrank every motion rule, including the new stamp
animation), so it now carries a suppression with that reason rather than
being removed.

**Open:**

- Nothing has met a real model or a real database. `KOMPASS_TOKEN` was empty
  and there is no Neon project yet, so no station has received an actual
  reply. First real session is also the first integration test.
- The model names in `PINS` are taken from the spec's roster and have not
  been checked against what the gateway currently serves. A name it no longer
  knows degrades to the lane, so this fails soft — but `zoo` would show fewer
  than three answers, and that is worth verifying before Voyage 3.
- Streaming, voice input, and a small-model pass on the input filter are all
  unbuilt and all in ARCHITECTURE.md under Known gaps.
- The `echt` scenes are the weakest part of the app. If image generation
  becomes reachable, that station deserves rebuilding.

---

## Fixed the Modell-Zoo, added five voyages, illustrated everything

**Asked:** more pictures — "its too text for engaging a kid" — and "fully add
more subjects". Clarified before building: more AI-literacy voyages rather
than new school subjects, bolder illustrations rather than the instrument
aesthetic, and fold in the Zoo fix.

**Found first, and it changed the shape of the work.** Asked whether the
Kompass keys were all set, the answer was yes — and probing the gateway to
confirm turned up a shipped bug. `GET /v1/models` returns only the six lane
aliases. Pinned names like `kompass:google/gemini-3.6-flash` are *not*
rejected: the gateway answers 200 and silently serves its default lane. So the
Modell-Zoo asked three "different" models, received three answers from one
model, and revealed them to a ten-year-old as Gemini, DeepSeek and GLM. A
station whose subject is "models disagree, so check" was fabricating its own
evidence.

Nothing caught it because nothing failed — no error, no timeout, no empty
reply — so the fallback ladder never fired, and the tests passed because they
asserted what was *sent*, never what was honoured.

**Changed:** the router now uses lanes throughout; `zooTrio` draws from
`fast`/`agentic`/`hard`/`longctx`; the reveal names each model from the
gateway's own `x-kompass-served-by`, read back from the transcript rows the
round wrote. Five new voyages (7–11: Trainingsdaten, Verzerrung,
Urheberrecht, Agenten, Privatsphäre). Eleven voyage illustrations plus station
badges, drawn from three new design tokens (`sea`, `sun`, `coral`) added
across all nine themes.

**Decided, and why:**

- *Lanes, not pins, and never again a table of model names.* What she is told
  a model was now comes from what actually answered. A table can drift out of
  truth silently; a response header cannot.
- *`kompass-simple` is excluded from the Zoo roster* because it and
  `kompass-fast` both resolve to gpt-oss-120b — the same bug one level
  quieter.
- *A collapsed round admits it.* If fewer than two distinct models answered,
  the reveal says the same machine wrote all three rather than naming three.
  Better a dud round than a lesson in the opposite of checking.
- *`labor` verifies rather than asserts.* It compared `servedBy` on both
  halves; previously it hardcoded `sameModel: true`, which was an unchecked
  claim of exactly the kind this session was spent removing.
- *Illustrations bolder than the chrome.* The design direction rules out
  cartoon mascots and Fisher-Price primaries, not colour — so the drawings
  push scale and hue while keeping buoys, flags and deep water.

**Rejected:**

- *New school subjects* (maths, biology). Asked, and the answer was more AI
  literacy. It would also have collided with the app's hard rule that it
  refuses homework.
- *Suppressing the collapsed-round case.* Showing three names anyway would
  have hidden the remaining fragility from the only person who can act on it.

**Open:**

- Still no station has received a real model reply. The token and lanes were
  verified with curl; the app has not been run against them.
- The Zoo now depends on lanes resolving to distinct models. True today, not
  guaranteed. Re-probe occasionally.
- Voyage 6's parent note and several UI strings said "six" and had to be
  chased down. Worth remembering that the curriculum being data does not make
  the copy around it data too.
