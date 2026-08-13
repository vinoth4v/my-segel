# Segel

A guided AI-literacy app for one ten-year-old and her father.

Six weeks, six voyages. The lesson is not "here is a chat box" — it is that a
language model is a confident pattern-matcher that is frequently, plausibly
wrong, and that **she** is the one who checks. Week two is built entirely
around catching it lying.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.

## What it does

Sign in, and the app opens on the **Logbuch** — a ruled ledger page that fills
up over six weeks with every mistake she has caught, stamped in brass. It is
the home screen rather than a subpage, because the first thing she should see
is her own accumulated work.

From there, six voyages:

| # | Voyage | What happens |
|---|---|---|
| 1 | **Was ist das Ding?** | Her first conversation with a model, scoped to explaining itself honestly, plus a three-question check on the three rules |
| 2 | **Die Jagd** | The core week. She questions a *deliberately weak* model, and every time she catches it inventing something she presses **Das stimmt nicht**, says why in one line, and the catch is stamped into the Logbuch |
| 3 | **Der Zoo** | One prompt, three different models, labelled A/B/C. She ranks them and writes why — and only then are the names revealed |
| 4 | **Das Prompt-Labor** | Her prompt on the left, a version she assembles from four levers on the right, both run on *the same* model so the comparison means something. A meter scores her draft before it runs |
| 5 | **Die Werkstatt** | She describes a thing in plain German; the app builds a working single-file page and renders it in a sandboxed frame. She iterates by talking ("mach die Knöpfe orange"), and every version is kept with the sentence that produced it |
| 6 | **Echt oder Fake?** | Six drawn scenes, some with the exact mistakes an image model makes. She judges, then the tells are marked — hands, text, physics, light, count |

And a **Kapitäns-Deck** behind a second password: full transcripts including
the turns a filter stopped, progress per voyage, a catches-per-day chart, every
escalation from a free model to a paid one, the session and daily caps, and a
kill switch.

## What works, and what does not

**Works today.** All six voyages, playable end to end. The Logbuch with the
brass stamp. Per-station model routing through the Kompass gateway, including
the deliberately weak lane for the hunt and one shared model for both halves of
the prompt lab. Parallel three-model fan-out with per-column deadlines, so a
slow model does not hold up the other two. Artifact generation with
verify-then-accept and silent escalation, version history, and a sandboxed
frame with its own CSP. Input and output filtering on every model call. Server-
side session and daily caps, and the kill switch. Full transcripts, parent-
readable, not deletable from the child's side.

**Does not work, deliberately.**

- **No English.** The curriculum is German (du-form) throughout. The DE/EN
  toggle in the spec is not built, because "which language" was listed as an
  open question and authoring a second full curriculum on a guess is the
  expensive way to find out the answer. Nothing in the code hardcodes German —
  the strings that matter are in `content/voyages/`.
- **Echt oder Fake uses drawn scenes, not generated images.** The gateway
  speaks the Anthropic messages format and has no image endpoint, so
  `flux-1-schnell` is not reachable. The plates are authored SVGs carrying the
  real tells, and the station asks "does this add up?" rather than "is this a
  photo" — see `docs/ARCHITECTURE.md`.
- **No streaming.** Answers appear when they are complete. Adds a couple of
  seconds of waiting per turn.
- **No voice input.** Her typing is slow and this is the main friction risk in
  Voyage 4; it is an open question in the spec and stays open.
- **No memory across sessions.** Progress, catches and builds persist. The
  model's context does not — by design, it keeps the safety surface small.
- **One learner.** Every row carries a `learner` column and every query filters
  on it, but there is exactly one value. A second child needs a real user
  store, which is a decision to raise rather than to implement quietly.

## Run it

```bash
pnpm install
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into, and the same password is what unlocks the Kapitäns-Deck.

`KOMPASS_BASE_URL` and `KOMPASS_TOKEN` are what make the stations answer. The
optional `SEGEL_PIN_*` variables pin exact models where the choice is pedagogy
rather than taste; unset, every station uses a Kompass lane alias and the
gateway decides. Read `.env.example` before setting one — pinning the hunt to a
*good* model is the one change that silently destroys the curriculum.

```bash
pnpm test        # unit: curriculum, routing, filters, artifacts, prompt meter
pnpm typecheck
pnpm build       # must exit 0
pnpm test:e2e    # needs a build first
```

## Change it

The curriculum is data, not code. `apps/web/content/voyages/*.json` holds all
six weeks, validated against a Zod schema by `pnpm test`. Rewording a lesson,
adding bait to the hunt, or changing a debrief question is an edit to one JSON
file — no components involved.

Otherwise: say what you want in the app's page on the
[marketplace](https://werft-marketplace.vercel.app), or comment `@claude` on an
issue here. Either way Claude works on a branch and opens a pull request; five
gates run against a real preview on its own database branch, and a human
merges. Nothing reaches production on its own.

## Deployment

Merging to `main` deploys. Migrations are applied to production during that
build, before it starts — a failed migration fails the build and the previous
deployment keeps serving.
