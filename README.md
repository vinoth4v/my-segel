# Segel

A guided AI-literacy app for one 10-year-old and her father. Six weeks, in
German, built around one idea: a language model is a confident pattern-matcher
that is frequently and plausibly wrong, and she is the one who checks.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> why each change was made in `docs/SESSIONS.md`, and the original brief in
> `docs/segel-spec.md`.

## What it does

She opens the app and lands on her **Logbuch** — a ruled ledger page of every
mistake she has caught a model making, each one stamped in brass, with her own
words for how she spotted it. That is the home screen on purpose: the first
thing she sees is the evidence of her own work, not a menu of homework.

Underneath it are six voyages, each playable end to end today:

1. **Was ist das Ding?** — she talks to a model and asks it what it is.
2. **Die Jagd** — the core week. The app deliberately routes her to a *weak*
   model, she asks about things that do not exist, and every time she catches
   it inventing she presses **Das stimmt nicht**, says why, and earns a stamp.
3. **Der Modell-Zoo** — one question, three different models, labelled A/B/C.
   She ranks them and writes why *before* the names are revealed. The server
   does not tell the browser who is who until she has committed to an order.
4. **Das Prompt-Labor** — her prompt on the left, a stronger one she assembles
   from four levers on the right, both run on the *same* model so the
   comparison measures her wording rather than the model.
5. **Die Werkstatt** — she describes a small thing in plain German and it
   appears, running in a sandboxed frame. She changes it by talking. Every
   version is kept with the sentence that produced it.
6. **Echt oder Fake?** — six pictures, real and generated, with the tells
   revealed after she commits to a guess.

Her father gets a **Kapitäns-Deck** behind a second password prompt: every
transcript, a catch-rate chart, which model answered what, every escalation to
a paid model, anything the safety filters stopped, per-voyage notes on what to
talk to her about, time limits, and a kill switch.

## What works

- All six voyages, playable, with the curriculum authored as data.
- The catch → why → brass stamp loop, filed to a real Logbuch.
- Multi-model fan-out for the Zoo, tolerant of one model timing out.
- The Werkstatt build loop: generate, check the page mechanically, hand the
  model its own errors, escalate if it still fails. Version history included.
- Safety: input and output filters, a homework refusal that fires before any
  model call, a system prompt on every station, session and daily caps, and a
  kill switch — all enforced on the server.
- The gate: every surface requires the operator's session, the parent deck
  requires the password again.

## What does not

- **`echt` uses hand-drawn scenes, not generated images.** The gateway speaks
  a text protocol, so live image generation is not reachable, and the app is
  forbidden from fetching images. The tells taxonomy is real and so is the
  exercise, but the pictures are deliberate illustrations with the flaws built
  in, and they are more obvious than the real thing. The parent note says so
  and points at the better exercise: doing it together on her actual feed.
- **No voice input.** Her typing is the main friction in Voyage 4 and this
  would fix it. Not attempted.
- **No streaming.** Replies arrive whole. On the Zoo that means waiting for
  the slowest of three.
- **No persistent memory across sessions**, deliberately — progress and
  artifacts persist, the model's context does not.
- **Neon rather than Supabase**, and **no separate child login**. Both are
  deliberate; the reasoning is in `docs/ARCHITECTURE.md` under Decisions in
  force, and it is worth reading before "fixing" either.

## Run it

```bash
pnpm install
pnpm db:migrate     # needs DATABASE_URL
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into.

**Escape every `$` as `\$` when you paste the password hash into a local env
file.** Next expands `$NAME` there, so an unescaped scrypt hash silently
becomes a different string and correct credentials are rejected with no useful
error. This cost an hour once already.

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint
pnpm test:e2e       # needs pnpm build first
```

## Change it

The curriculum is data, not code: `apps/web/content/voyages/*.json`, validated
against a Zod schema. Rewording a week, reordering stations or adding seed
questions needs no component change — and the schema is strict, so a typo
fails the build rather than rendering an empty station in front of a child.

Otherwise: say what you want in the app's page on the
[marketplace](https://werft-marketplace.vercel.app), or comment `@claude` on an
issue here. Either way Claude works on a branch and opens a pull request; five
gates run against a real preview on its own database branch, and a human
merges. Nothing reaches production on its own.

## Deployment

Merging to `main` deploys. Migrations are applied to production during that
build, before it starts — a failed migration fails the build and the previous
deployment keeps serving.
