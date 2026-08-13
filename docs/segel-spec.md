# Segel — Build Spec v1

> A guided AI-literacy app for one 10-year-old and her father.
> Kompass gateway for the model roster, Claude for the seat next to her.

**Name.** *Werft* builds the ships. *Kompass* points them. *Segel* is the small boat that
actually goes somewhere. Nautical, German, pronounceable by a ten-year-old, and it slots
into the existing naming convention without explanation.
Alternates if it doesn't land: **Boje** (buoy — a thing you hold onto in deep water) or
**Nordstern**.

---

## 1. Problem

A 10-year-old with basic computer skills is already surrounded by AI output — YouTube
recommendations, AI-generated video, AI voices, classmates using chatbots on homework —
and has no framework for any of it. Handing her a chat box teaches her that AI is an
oracle. The thing worth teaching is the opposite: that it's a confident pattern-matcher
that is frequently, plausibly wrong, and that she is the one who checks.

Curriculum alone (a PDF, a weekly sit-down) decays after week two. The lesson has to be
*inside* the tool, and the tool has to be safe enough to hand over.

## 2. Goals

1. She can state, unprompted, what an LLM is and why it makes things up.
2. She catches a fabricated answer without being told to look for one — measured by the
   Logbuch: unprompted catches per session trending up over six weeks.
3. She can improve a bad prompt into a good one and articulate what she changed.
4. She has built at least three things she chose herself and shown them to someone.
5. She can spot AI-generated media in her own feed and say what tipped her off.
6. Father-side: full transcript visibility, zero surprise costs, runs on existing free
   infrastructure.

## 3. Non-goals

- **Not an open chatbot.** Every conversation happens inside a lesson with a scoped
  system prompt. No free-roaming chat surface in v1.
- **Not homework help.** Explicitly refused in the system prompt. That's a rule from the
  curriculum, and the app should enforce it rather than rely on her honesty.
- **Not multi-user / not a product.** One family, one deployment. No signup flow, no
  billing, no accounts beyond two. Building for a general audience would triple the scope
  and destroy the safety model.
- **Not a coding course.** She makes things by describing them, not by writing code. If
  she wants code later, that's a different app.
- **No persistent memory across sessions in v1.** Progress and artifacts persist; the
  model's context does not. Keeps the safety surface small.

## 4. Users

**Segler (the learner).** 10, reads fluently, types slowly, patient with a game and
impatient with a lecture. Needs immediate visible feedback and a reason to come back.

**Kapitän (the parent).** Wants transcripts, wants to know what she's been told, wants
to be pulled in at the right moments rather than hovering permanently. Some lessons are
deliberately two-seater and the app should say so.

## 5. Curriculum as data, not code

The six-week curriculum lives in `/content/voyages/*.json` — not hardcoded in components.
This is the single most important architectural decision: it makes the curriculum
editable without a deploy story, and it lets a model help author future modules.

```
Voyage (week)
  ├─ id, title, subtitle, estMinutes, twoSeater: bool
  ├─ intro: { markdown, illustrationPrompt }
  ├─ Stations[]           # 2–4 per voyage
  │    ├─ type: talk | zoo | jagd | labor | werkstatt | echt | quiz
  │    ├─ prompt scaffold, seed examples, success condition
  │    └─ modelPolicy: <see §7>
  └─ debrief: { questions[], parentNote }
```

### The six voyages

| # | Title | Station types | Teaches |
|---|---|---|---|
| 1 | Was ist das Ding? | intro, talk | Mental model; the three rules |
| 2 | Die Jagd | jagd, logbuch | It is confidently wrong — **the core week** |
| 3 | Der Zoo | zoo, quiz | Different models, different answers, no single "the AI" |
| 4 | Das Prompt-Labor | labor | Specificity, role, constraints |
| 5 | Die Werkstatt | werkstatt | She can make things now |
| 6 | Echt oder Fake? | echt, debrief | Synthetic media literacy |

Voyage 2 runs before Voyage 3–5 deliberately. Skepticism gets installed before capability.

## 6. Stations (the feature set)

**`talk` — Gespräch.** Scoped chat. Warm persona, kid-appropriate register, hard refusal
on homework and personal data. Suggested-question chips so she isn't staring at an empty
box.

**`jagd` — Die Jagd (Hallucination Hunt).** She asks about something that doesn't exist,
or about something she's an expert in. The app *deliberately routes to a weak free model*
and gives her a **[Das stimmt nicht!]** button. Pressing it opens a one-line "why?" field
and files the exchange in her Logbuch as a scored catch. Weak models are a feature here,
not a compromise — this is the one place where the failure mode of free inference is
exactly the pedagogy.

**`zoo` — Der Modell-Zoo.** One prompt, three models from the Kompass roster, side by
side, labelled A/B/C. She ranks them and says why before the names are revealed. Then the
names appear with size/origin. This is the app's crown jewel and it exists *only* because
the gateway already has fifteen models behind one endpoint. Nobody else's kid has this.

**`labor` — Prompt-Labor.** Split view: her prompt on the left, a "stronger" version on
the right that she assembles from levers (*who should it be · what exactly · what not ·
how long*). Both run. Outputs sit side by side. A prompt-strength meter scores her draft
before she runs it.

**`werkstatt` — Werkstatt.** She describes a thing; the app generates a single-file HTML
artifact and renders it in a sandboxed iframe. She iterates in plain language ("make the
buttons purple, add a timer"). Saved to her Galerie with the prompt history attached, so
she can see her own prompting improve.

**`echt` — Echt oder Fake?** Six images, some real, some generated on the fly via
`flux-1-schnell`. She picks, then gets the tells overlaid — hands, text, physics,
lighting. Directly connects to what she already watches.

**`logbuch` — Logbuch.** Her running notebook of caught errors, ranked model outputs, and
saved builds. Persistent across all six weeks. This is the retention mechanic and the
success metric in one object.

**Kapitäns-Deck (parent).** Full transcripts, progress per voyage, catch-rate chart,
session time cap, kill switch, and a per-voyage "talk to her about this" note.

## 7. Model routing

The whole point of building this on Kompass rather than straight Anthropic: different
stations want genuinely different models, and most of them want free ones.

| Station | Route | Model | Rationale |
|---|---|---|---|
| `talk` | **Anthropic direct** | Haiku 4.5 | Child-facing open conversation. The one place not to economise — instruction-following on the safety prompt is the product. Cheap enough to be irrelevant. |
| `jagd` | Kompass, **pinned** | `gpt-oss-120b`, small laguna tiers | Weak-and-confident is the desired behaviour |
| `zoo` | Kompass, rotating trio | `gemini-3.6-flash`, `deepseek-v3.2`, `glm-5.2`, `minimax-m3`, `nemotron-3-super` | Roster variety is the lesson |
| `labor` | Kompass, **same model both sides** | any mid-tier, pinned | Must be pinned — if the model varies, the prompt comparison is invalid. Non-obvious and easy to get wrong. |
| `werkstatt` | Kompass → **Claude fallback** | `qwen3-coder-next` / `devstral-medium`, escalate to Sonnet 5 on render failure | Free models fail to produce working code often enough that a silent fallback is required. A broken artifact in front of a 10-year-old is a failed session. |
| `echt` | Kompass | `flux-1-schnell` | Image generation |
| grading / scoring her answers | Kompass | any small free | Low stakes |
| content authoring (build time) | **kompass-claude** | Opus 5 plan, free models implement | Existing orchestrator, offline |

Implementation: one `lib/router.ts` with `route(stationType) → {baseUrl, model, headers}`.
Kompass pinning via `kompass:<provider>/<model>`. Bearer token **server-side only** — all
inference goes through Next.js route handlers, never the browser.

Fallback rule: any Kompass call that errors, times out (>20s), or returns unrenderable
output retries once on a different free model, then escalates to Claude. Escalations are
logged to the Kapitäns-Deck so the free/paid ratio is visible.

## 8. Safety

Non-negotiable, and cheaper to build in now than to retrofit:

- **Input filter** before every call: regex + small-model pass for names, address, school,
  phone. Blocked with a friendly in-character message, not an error.
- **Output filter** on every response before render. On trip: swap for a neutral message
  and log to the parent deck.
- **System prompt** on every station: audience is 10, refuse homework completion, refuse
  personal-data collection, no scary content, no romantic content, redirect anything
  emotional or heavy to "ask Papa".
- **No open web access** from any station.
- **Session cap** (default 40 min) and a per-day cap, enforced server-side.
- **Full transcript retention**, parent-readable, never deleted by the child.
- **Sandboxed iframe** for Werkstatt artifacts: `sandbox="allow-scripts"`, no
  `allow-same-origin`, strict CSP, no network egress from generated code.

## 9. Design direction

The failure mode is a purple-gradient chatbot that looks like every other AI app, or a
Fisher-Price primary-colour kids' app that a 10-year-old finds insulting. She's ten, not
five — she plays real games.

**Direction: harbour chart.** Nautical instrument, not cartoon boat.

- **Palette:** deep harbour navy `#12263A` ground, aged paper `#EDE3D0`, signal orange
  `#E8622C` for actions, brass `#C9A227` for earned things, sea-glass `#5FA8A0` for
  correct/caught. Deliberately *not* the cream + terracotta default.
- **Type:** a condensed grotesque for display (chart-label feel), a high-legibility
  humanist sans for body at generous size — she reads fluently but not fast.
- **Signature element:** the **Logbuch as a physical object** — a ruled ledger page where
  every caught error gets stamped in brass, accumulating visibly over six weeks. It's the
  home screen, not a subpage. Her progress should look like something she made.
- **Motion:** one orchestrated moment — the stamp landing on a catch. Nothing else
  animates. Restraint is what keeps it from reading as generated.
- **Copy:** German informal (du), short sentences, active voice. No exclamation marks in
  system copy — praise means nothing if everything is exciting.

Point the werft harness at this section rather than letting it default.

## 10. Stack

- Next.js App Router on **Vercel Hobby** — no Sandbox usage, so it doesn't touch the
  snapshot-storage headroom that's already tight
- **Supabase free tier** — progress, logbuch, transcripts, artifact gallery. Postgres +
  RLS with two roles (segler read/write own, kapitän read all)
- Auth: parent passphrase → child profile. No email, no OAuth, no third-party identity
- Content in-repo as JSON, deployed with the app
- `pnpm test && pnpm typecheck && pnpm lint` before `pnpm deploy`, matching the Kompass
  repo convention

Running cost target: **€0 infrastructure**, and only Haiku-tier tokens for `talk` plus
occasional Sonnet escalations in `werkstatt`.

## 11. Build phases

**Phase 0 — Content (do this first, before any UI).**
All six voyages authored as JSON via kompass-claude. Half of it already exists as the
weekly plan. Deliverable: `content/voyages/*.json` validated against a Zod schema. This
is the phase that determines whether the app is good; everything else is plumbing.

**Phase 1 — Walking skeleton.** Next.js shell, Supabase schema, parent passphrase,
`lib/router.ts` with both backends, and Voyage 1 playable end to end including one `talk`
station. *Acceptance: she completes Voyage 1 unaided and the transcript appears in the
parent deck.*

**Phase 2 — Die Jagd + Logbuch.** The core loop. Weak-model routing, the catch button,
the scoring, the brass stamp. *Acceptance: three unprompted catches in one session, all
filed correctly.*

**Phase 3 — Zoo + Labor.** Multi-model fan-out with parallel streaming, blind ranking,
reveal. Pinned-model prompt comparison. *Acceptance: three models render side by side in
under 8 seconds; a timeout on one doesn't block the other two.*

**Phase 4 — Werkstatt.** Artifact generation, sandboxed render, iteration loop, gallery,
Claude fallback path. Ported from the replforge agent loop and checkpoint model — see
§13. *Acceptance: ten consecutive builds render without a blank frame.*

**Phase 5 — Echt oder Fake + polish.** Image generation, tells overlay, full parent deck,
session caps, DE/EN toggle, mobile layout.

Phases 1–2 are the minimum shippable thing. If it stalls after Phase 2, she still gets
the single most valuable week of the curriculum in working form.

## 12. Success metrics

Leading: sessions completed per week (target 1); unprompted catches per session in
Voyage 2+ (target: rising, ≥3 by week 4); Werkstatt builds she chose to show someone.

Lagging, and the ones that actually matter: six weeks after finishing, does she
spontaneously question an AI answer in front of you, and does she still open the Logbuch
without being asked.

Anti-metric: **time in app**. If she's in there for two hours it has failed. Cap it.

## 13. Reuse from replforge

Replforge is a developer tool. Segel is a children's toy with a curriculum attached. The
**server-side spine transfers almost completely; the client transfers almost not at all.**
Getting this backwards — reusing the workspace UI because it exists — is the single
biggest risk to this project.

### Take

| Replforge capability | Segel use | Notes |
|---|---|---|
| **Agent loop** — plan → generate → run → read errors → self-correct | `werkstatt` | The highest-value reuse by far. Segel needs the same loop with the target narrowed to one self-contained HTML file. Rip out multi-file planning; keep the verify-then-report contract. |
| **Checkpoint / rollback** | Galerie version history | Direct lift, and it gains a *pedagogical* purpose it never had in replforge: she scrubs back through her own versions and sees her prompts getting better. Keep the prompt that produced each checkpoint. |
| **Model client + streaming** | `lib/router.ts` | If replforge already speaks the Anthropic wire format, Kompass is a base-URL swap. The parallel fan-out needed for `zoo` is a small extension of the same client. |
| **Auth + per-user ownership / RLS** | Kapitän / Segler roles | Two users instead of many, so simplify the schema but keep the row-level ownership pattern rather than reinventing it. |
| **Secrets handling / server-side key custody** | Gateway token custody | Whatever pattern keeps keys out of the browser, reuse it verbatim. |
| **Diff generation** | *Internal only* | Useful for the agent's self-correction. Never shown to her — see below. |

### Leave

- **Sandboxes and live preview URLs.** Segel renders into a sandboxed iframe instead.
  This is both a safety decision and a cost one: Vercel Sandbox snapshot storage is
  already near the 15 GB Hobby cap, and Segel must not touch that headroom.
- **Editor, file tree, terminal.** A ten-year-old describing an app should never see a
  file. The moment she does, the app is teaching her to be a junior developer instead of
  teaching her how AI behaves.
- **Managed DB provisioning and data browser.** Segel's persistence is Supabase, fixed
  schema, no per-project databases.
- **Deployment, custom domains, collaboration.** Out of scope entirely.
- **The entire design language.** Replforge's vocabulary — diff, commit, log, sandbox,
  deploy — is exactly the register to avoid. Harbour chart, not IDE.

### Rule of thumb

Reuse anything that runs on the server and anything that makes generated code *actually
work*. Rewrite everything she can see.

## 14. Open questions

- **Language.** German default with EN toggle, or English-only? Depends on her school
  language and on whether you want this to double as English practice. Blocking for
  Phase 0 content authoring.
- **Does she get her own device access, or is it always at your machine?** Changes the
  auth model and the session-cap enforcement.
- **Voice input?** Her typing is slow, and slow typing is the main friction risk in
  Voyage 4. Whisper via the gateway would fix it. Non-blocking, but decide before Phase 3.
- **Persistent per-child memory in v2?** Deliberately out of v1. Revisit once you've read
  six weeks of transcripts and know what she actually asks.
