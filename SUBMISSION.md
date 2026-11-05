# Submission

**Akin Docs** — a lightweight collaborative document editor
Akintunji Sule · `akintunji.sule@gmail.com` · November 2026

---

## Links

| | |
|---|---|
| **Live app** | https://ajaia-docs-iota-ebon.vercel.app |
| **Walkthrough video** | `<VIDEO_URL>` |
| **Source** | https://github.com/AkinSu/ajaia-docs |

**No credentials needed.** Sign-in is a one-click list of seeded accounts.

| Account | Email | Use it to see |
|---|---|---|
| Alice Nwosu | `alice@ajaia.test` | An owner with documents, one already shared out |
| Bob Castellano | `bob@ajaia.test` | An **editor** on Alice's plan, owner of his own notes |
| Carol Mehta | `carol@ajaia.test` | An empty account — share something to her live |

> To be two users at once, use an **incognito window** or a second browser profile. A
> session cookie belongs to a browser profile, not a tab.

---

## What's included

| File | What it is |
|---|---|
| `README.md` | Setup, run instructions, a 2-minute demo script, seeded accounts, scope |
| `ARCHITECTURE.md` | Design reasoning, tradeoffs, infrastructure choices, what's next |
| `AI_WORKFLOW.md` | Which AI tools, where they helped, what I rejected, how I verified |
| `SUBMISSION.md` | This file |
| `app/` `components/` `lib/` | Application source |
| `lib/access.test.ts` `lib/convert.test.ts` | 44 automated tests |
| `samples/` | Sample `.md`, `.txt` and `.docx` files for testing import |
| `.github/workflows/ci.yml` | CI: typecheck, lint, tests on every push |
| `.env.example` | The two environment variables needed |

---

## Working end to end

**Document list** — a grid of preview cards showing a miniature of each document's real
content, with the name and metadata underneath.

**Documents** — create, rename inline, edit, reopen. Bold, italic, underline, H1–H3,
bulleted and numbered lists, with toolbar active states.

**Images** — insert PNG/JPEG/GIF/WebP up to 2 MB. Selecting a picture shows a size
control under it (Small / Medium / Large / Full, plus Remove), attached to the image
rather than buried in the toolbar. Images are stored per document and served through the same authorization
check as the document, so they are exactly as private as the document holding them.

**Pagination** — content flows onto real pages with a gutter between sheets and matching
top and bottom margins; blocks that would cross a boundary move to the next page.

**Download as PDF** — a print stylesheet plus the browser's own "Save as PDF". No
dependency, nothing server-side. The PDF is genuinely paginated.

**Demo limits** — 50 documents per account, 50 images per document, enforced server-side.

**Autosave** — debounced 800 ms, flushed on tab hide and page unload, with a live
`Saving… / Saved 4:52 PM / Not saved` indicator.

**Conflict handling** — saves carry the version they were based on. A concurrent save
returns `409`, autosave stops, and a banner explains what happened rather than
overwriting the other person's work.

**Sharing** — share by email as **Can edit** or **View only**; change a role; revoke
access. Enforced server-side on every request.

**Access control** — no access returns `404`, never `403`, so document ids can't be
enumerated. Viewers are genuinely read-only: a hand-crafted `PATCH` from a viewer is
rejected by the server, not just hidden in the UI.

**Import** — `.txt`, `.md`/`.markdown`, `.docx` up to 1 MB become new editable
documents with formatting preserved. Unsupported types, oversized and empty files are
rejected with specific messages. The uploaded file is parsed and discarded, never stored.

**Persistence** — documents, formatting and sharing all survive refresh, stored as
ProseMirror JSON in Postgres.

**Validation** — Zod on every request body, plus content re-validated against the real
ProseMirror schema, so a crafted request can't persist markup the editor wouldn't produce.

---

## Partial or intentionally not built

| | Status | Reasoning |
|---|---|---|
| Real-time co-editing | **Not built.** Conflicts are detected and surfaced, not merged. | A correct CRDT sync backend is days of work on serverless. The architecture note explains the full reasoning. |
| Authentication | **Mocked, by design.** Anyone can sign in as anyone. | Explicitly permitted by the brief. Authorization *between* accounts is enforced properly — that's the part worth building. |
| HTTP-layer tests | **Partial.** Policy and converters are unit tested in CI; routes were verified with a scripted `curl` pass over every status code, not automated. | Would be the first thing I'd add to CI. |
| Comments, version history | **Not built.** | Optional stretch items. Depth over breadth. |
| Image drag-resize | **Preset widths only** (25/50/75/100%). | Drag handles are a lot of pointer-event code for the same result. |
| Mid-block page splitting | **Not built.** Pages break between blocks; a paragraph taller than a page overhangs. | Splitting inside a block means laying out individual text runs — a typesetting engine, not a plugin. |
| Orphaned image cleanup | **Not built.** Deleting an image from a document leaves its row. | A sweep for unreferenced assets is the follow-up. |
| `.docx` fidelity | **Partial.** Headings, bold/italic and lists import. Tables, images, footnotes and tracked changes are dropped. | mammoth maps to semantic HTML rather than rendering faithfully — the right tradeoff for an editable document. |
| Mobile | **Usable, not tuned** below tablet width. | |

---

## With another 2–4 hours

1. **Presence and live refresh** (~1h) — poll for "Bob is viewing", and auto-refresh a
   read-only document when its version changes. Most of the *feeling* of collaboration
   for a fraction of a CRDT's cost.
2. **Version history** (~1.5h) — append-only snapshot per save, with restore. Additive
   to the existing schema, and it upgrades the conflict story from "we stopped you" to
   "and you can recover."
3. **Route-handler tests in CI** (~1h) — promote the `curl` matrix into automated
   integration tests so the 404-not-403 guarantee can never silently regress.
4. **Export to Markdown** (~30m) — `@tiptap/markdown` round-trips everything except
   underline.

---

## Verifying it yourself in 2 minutes

1. Sign in as **Alice** → open **Q4 Product Plan** → edit it, apply formatting, refresh.
   Formatting persists.
2. **Share** → `carol@ajaia.test` → **View only**.
3. Incognito window → sign in as **Carol** → the document is under **Shared with me**
   with a *View only* badge and a read-only editor.
4. Back as Alice → **Import a file** → pick anything from `samples/`.
5. To see conflict handling: open the same document as Alice and as Bob (incognito),
   type in both, and the second save shows the conflict banner.
