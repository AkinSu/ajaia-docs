# AI workflow note

**Tool used:** Claude Code (Claude Opus 5) as the primary development environment, with
parallel subagents for research and one isolated implementation task.

The short version: AI was most valuable for **compressing research** and for **one
well-specified, self-contained module**. It was least trustworthy on **infrastructure
claims** and **anything requiring a judgment call about tradeoffs**, which is where I
overrode it.

---

## Where it materially sped up the work

### Parallel research triage (~45 minutes saved)

Before writing code I ran three research agents concurrently against current
documentation: one on editor libraries and the docx pipeline, one on free-tier hosting
and database options, one on the company and the brief itself.

Three findings changed the build, and I would not have found them as fast alone:

- **Supabase pauses free projects after ~7 days idle** and needs a manual un-pause. The
  brief is reviewed asynchronously — that would have meant a dead demo URL on a reviewer's
  click. Switched to Neon, which does not pause.
- **`@tiptap/html`'s default export throws on the server** — `generateJSON` is
  browser-only unless imported from the `@tiptap/html/server` subpath. This is the kind of
  error that costs 30 confused minutes at exactly the wrong moment.
- **Tiptap StarterKit v3 bundles Underline**, which v2 did not. Underline is explicitly
  required by the brief, so this determined the library version.

### One delegated module: the import pipeline

I handed `.txt`/`.md`/`.docx` → document JSON to a single agent with a tight contract —
exact exports, exact error codes, named files it owned and nothing else — while I built
the schema, auth and editor. It came back with 30 passing tests including a **real
`.docx` round-trip**: no docx-writing library was installed, so it found `jszip` in
mammoth's dependency tree and hand-assembled the OOXML parts rather than taking the easy
path of skipping that test.

This worked because the module was genuinely separable and the contract was explicit.
The parts I kept — editor, routes, sharing — all touch the same files and would have
collided.

### Boilerplate

Drizzle schema definitions, Zod schemas, Tailwind markup, the seed script. Fast and
mostly correct, and cheap to verify because mistakes surface immediately in typecheck or
the browser.

---

## What I changed or rejected

This is the part I would want a reviewer to read.

| AI output | What I did | Why |
|---|---|---|
| Use Neon's HTTP driver (`neon-http`) — leanest on serverless | **Rejected.** Switched to `node-postgres`. | It only speaks to Neon's endpoint, so the app could not run against a local Postgres — meaning I could not verify anything end to end without provisioning cloud infra first. Testability beat the marginal serverless efficiency. The pooled connection string solves the connection-exhaustion concern anyway. |
| Detect stale saves by comparing `updatedAt` and ignoring older writes | **Rejected.** Used a version column returning `409`. | "Ignore older saves" silently discards a collaborator's work. A guard that surfaces the conflict is the only version I would defend in a review. |
| Make the repo public for unlimited CI minutes | **Rejected.** | A private repo's 2,000 free minutes vastly exceed what a handful of Vitest runs needs, and a public repo publishes the solution to future candidates. Wrong tradeoff, confidently stated. |
| A research agent reported the brief *requires* owner/editor/viewer RBAC and lists excluded features | **Corrected.** | It had triangulated from other candidates' public repos rather than the brief. The actual brief lists roles as *optional stretch* and has no exclusion list. Treating another model's inference as a requirement would have skewed the whole scope. |
| A 10-persona "agent team" (frontend, backend, infra, security, PM, reviewer…) | **Declined.** | Ten personas writing overlapping prose is coordination cost, not throughput, against a fixed deadline. I used the role breakdown as a **checklist** and ran two agents where the work was genuinely parallel. |
| `create-next-app` scaffolded `cacheComponents: true` | **Disabled.** | Every page here is per-user and session-dependent. It cached nothing useful and forbade the route-segment config the import route needs. |
| Generated code imported upload constants from `lib/convert.ts` into a client component | **Caught by the build, then fixed.** | It dragged mammoth and happy-dom into the browser bundle. Split the constants into a client-safe module. A good example of AI output that typechecks cleanly and is still wrong. |

The pattern: AI was reliable on **"what is the API"** and unreliable on **"what should we
do about it."** Every infrastructure recommendation needed its *reasoning* checked, not
just its facts — several were defensible in general and wrong for this situation.

---

## How I verified correctness

I did not trust generated code because it looked right or because tests passed.

**1. Automated tests (44), aimed at the two things worth testing.**
The full authorization matrix — four roles against four actions, plus ownership winning
over a conflicting share and anonymous callers resolving to no access — and the import
pipeline including the real `.docx` round-trip and script-stripping.

**2. A scripted end-to-end pass over the live API**, exercising the paths where a bug
would be a security problem rather than a glitch:

```
carol GET / PATCH / DELETE / share another user's doc  → 404 (not 403: ids stay unenumerable)
nonexistent document id                                 → 404 (indistinguishable)
alice (viewer) PATCH content / rename / share           → 403
alice saves v1 → 200 (v2);  bob saves stale v1 → 409;  bob saves v2 → 200 (v3)
share with self / unknown email / malformed email       → 400 with a specific message
injected "script" node in content JSON                  → 400 (schema rejects it)
.pdf upload                                             → 400 with supported types listed
```

Each of these was run against a real database, not mocked. The conflict sequence in
particular is the behaviour I would be asked about in review, so I wanted to watch the
version actually increment.

**3. Browser verification of every surface.** Sign-in, the owned/shared split, the
editor, toolbar active states, the autosave indicator moving to `Saved 4:52 PM`, and the
share dialog. Automated tests would not have caught a hydration mismatch or an
unreadable toolbar.

**4. Production build on every change.** The client-bundle leak above was caught by
`next build`, not by tests or typecheck — which is precisely why it ran continuously
rather than once at the end.

---

## Honest assessment

AI made this roughly **two to three times faster**, concentrated in research and
boilerplate rather than in the parts that required decisions. The architectural calls
that matter here — 404-over-403, version guards over timestamp comparison, storing
structured JSON over HTML, refusing to auto-retry a conflict — were ones I had to make
and in several cases had to make *against* a confident recommendation.

The failure mode to watch for is not AI writing broken code; typecheck and tests catch
that. It is AI writing **plausible, working code that encodes the wrong tradeoff** —
the `updatedAt` stale-save check would have passed review and silently lost data in
production. Verification has to target intent, not just correctness.
