# Architecture note

**Ajaia Docs — a collaborative document editor**
Akintunji Sule · November 2026

---

## The shape of the problem

The brief asks for a Google Docs-style editor across five surfaces — editing, file
upload, sharing, persistence, engineering quality — inside a few hours. Most of that
list is well-trodden: a modern editor library gives you rich text, and CRUD over
Postgres gives you persistence.

Two things in the list are *not* routine, and I spent the time there:

1. **Sharing** is the only requirement with real logic in it. Getting it wrong is the
   difference between a demo and a liability.
2. **"Collaborative"** implies two people in one document, which is the hardest problem
   in the brief and the one most likely to be faked.

Everything below follows from putting depth into those two and keeping the rest
deliberately plain.

---

## What I prioritized, and why

### 1. Authorization is one function, tested exhaustively

All access rules live in [`lib/access.ts`](./lib/access.ts) as pure functions with no
database access:

```ts
resolveAccess(userId, document, share) → "owner" | "editor" | "viewer" | null
canRead(role) · canEdit(role) · canManageSharing(role) · canDelete(role)
```

Route handlers load rows and ask this module what the caller may do. They never decide
for themselves. Because the policy is pure, the entire permission matrix is unit tested —
four roles against four actions, plus the two cases that are easy to get wrong:
ownership must win over a conflicting share row, and an anonymous caller must resolve to
`null` rather than falling through.

**The UI is not a control.** Hiding the toolbar from a viewer is a courtesy. The `PATCH`
handler re-checks on every write, so a hand-crafted request from a viewer gets `403`
regardless of what the browser showed them.

### 2. Missing and forbidden are the same answer

A caller with no access gets **`404`, not `403`**. A `403` would confirm that a document
exists, which turns a document id into an oracle: an attacker could enumerate ids and
learn what your organization has, even without reading any of it.

`403` is reserved for the case where existence is genuinely not a secret — a viewer who
can already open a document but tried to save it. They learn nothing new from the error.

Both paths are covered by tests, and `loadDocumentForUser` returns `null` for "no such
row" and "no access" alike so the two cannot drift apart later.

### 3. Concurrent edits

This is the part of the brief I most wanted to answer honestly.

**What real-time collaboration actually costs.** Google Docs resolves concurrent edits
with operational transforms; the modern equivalent is a CRDT such as Yjs. The library is
not the hard part — the hard part is the sync backend. On serverless, a WebSocket pins
to a single function instance, reconnects are not guaranteed to land on that same
instance, and correct multi-user sync needs cross-instance pub/sub behind it. That is
days of work. The managed shortcuts either shut down (PartyKit's hosted platform closed
in October 2026) or bind the demo to a personal API key with vendor branding, which cuts
against the brief's "reviewers must not pay for anything."

**What I built instead.** Optimistic concurrency with a version column:

```ts
update(documents)
  .set({ content, version: sql`version + 1` })
  .where(and(eq(documents.id, id), eq(documents.version, expectedVersion)))
```

The client sends the version it loaded. If no row matches, someone else saved first. The
server returns `409` with its current state, the editor **stops autosaving** and shows a
banner telling the user what happened.

**The detail that matters:** it never retries automatically. An automatic retry at a
higher version would make the conflict disappear by overwriting the other person's work —
silently losing data while appearing to succeed. Surfacing the conflict is worse UX and
correct behaviour, and I would rather ship the honest one.

This is last-write-wins *with a guard*. Two people typing in the same paragraph still do
not merge. It is a deliberate floor, not a finished collaboration story.

### 4. Content is structured, never markup

Documents are stored as **ProseMirror JSON in a `jsonb` column**, not HTML and not
Markdown.

- **Not HTML** — storing markup means eventually rendering it, which is an XSS surface
  for a product whose whole purpose is showing other people's documents.
- **Not Markdown** — lossy for this feature set. Underline has no CommonMark syntax, and
  underline is explicitly required.
- **JSON** — round-trips losslessly and is validated structurally.

That last point is also a security boundary. On every save, content is parsed against
the *real* ProseMirror schema in [`lib/validation.ts`](./lib/validation.ts), so any node
type, mark or attribute the editor could not have produced is rejected. The same schema
([`lib/editor-extensions.ts`](./lib/editor-extensions.ts)) is shared by the browser
editor and the server-side import converter — if they diverged, an import could produce
a document the editor cannot render.

### 5. Uploads are parsed and thrown away

`.docx` → mammoth → HTML; `.md` → marked → HTML; `.txt` → escaped paragraphs. All three
then go through the Tiptap schema into document JSON.

**The uploaded file is never persisted.** That removes blob storage, the cost and
latency of serving user files back out, and an entire category of attack — nobody can
upload something and later convince the app to hand it to someone else. Import becomes
content, not an attachment.

Routing everything through the schema is also what sanitizes it: `<script>` tags,
`onclick` handlers and unknown elements aren't in the schema, so they're discarded
rather than filtered. That's a stronger guarantee than a blocklist, and it's tested.

### 6. Images are as private as the document that holds them

Image bytes live in a `document_assets` row keyed to a document, not in a blob service.
For a handful of small pictures another provider is not worth the setup, the cost or the
extra failure mode — and keeping them in Postgres means serving one is an ordinary
authorization check rather than a separate access-control system.

`GET /api/assets/[id]` resolves the owning document first and runs the same
`loadDocumentForUser` check as everything else, so a stranger gets `404` and a signed-out
caller gets `401`. The alternative — a public URL with an unguessable id — would mean
that sharing a document silently published its pictures to anyone who ever saw the link,
and that revoking access left the images readable forever.

Two related decisions:

- **Widths are percentages, not pixels.** A picture sized on a wide monitor would
  otherwise overflow a narrower one. Four presets (25/50/75/100%) cover the need without
  the pointer-event code that drag handles require.
- **`.docx` imports drop embedded pictures.** mammoth's default inlines a base64 data URI
  per image, which would push a modest file past the 1 MB document limit and store image
  bytes inside the content JSON. Images added in the editor go to the asset table instead.

### 7. PDF export is a stylesheet

"Download PDF" calls `window.print()`. A print stylesheet hides the app chrome, turns the
on-screen card into the page itself, and keeps headings with their text.

Server-side rendering (Puppeteer plus a bundled Chromium) would produce a more controlled
file, at the cost of a ~50 MB dependency, a slow cold start and a function that can time
out. For a document that is already HTML, the browser's own print pipeline is the right
tool, and it costs nothing to run.

---

## Infrastructure choices

| Decision | Why | Rejected alternative |
|---|---|---|
| **Vercel** | No idle spin-down; a reviewer clicking days later gets a fast page. | Render/Railway sleep after inactivity — a ~60s cold start is a bad first impression. |
| **Neon Postgres** | Free tier does not pause projects for inactivity; compute scales to zero and wakes transparently. | **Supabase pauses free projects after ~7 days idle** and needs a manual un-pause. For a take-home reviewed later that is a dead demo. |
| **Not SQLite** | The brief offers SQLite or a file store. On Vercel the filesystem is read-only except `/tmp`, which is ephemeral per invocation — documents would silently vanish in production while working perfectly in development. | A trap worth naming explicitly. |
| **node-postgres, not a Neon-specific driver** | Identical code runs against local Docker Postgres and Neon, so the app is testable locally. | Neon's HTTP driver is leaner on serverless but only talks to Neon, which made local verification impossible. |
| **Pooled connection string** | Serverless opens a connection per invocation; Neon's `-pooler` host fronts PgBouncer so Postgres connection slots are never exhausted. | Direct connections fail under concurrency. |
| **Mocked auth** | Explicitly permitted. Seeded accounts let a reviewer switch identity in seconds, and the saved time went into access control, which is the part worth doing properly. | Real auth would have consumed the sharing budget for no evaluative gain. |

---

## Data model

```
users              (id, email unique, name)
documents          (id, owner_id, title, content jsonb, version, created_at, updated_at)
document_shares    (document_id, user_id, role: viewer|editor)   PK(document_id, user_id)
document_assets    (id, document_id, uploaded_by, mime_type, byte_size, data, created_at)
```

Ownership lives on `documents.owner_id` and is **not** a share row, so an owner can never
be demoted or revoked by accident. The composite primary key on `document_shares` makes
double-sharing impossible at the database level rather than in application code.

---

## What I would build next, in priority order

1. **Presence and live refresh** (~1h) — poll for "Bob is viewing", and refresh a
   read-only document when the version changes. Most of the *feeling* of collaboration
   for a fraction of the cost of a CRDT.
2. **Version history** (~1.5h) — an append-only snapshot per save with restore. The
   schema already carries a version number, so this is additive. It also upgrades the
   conflict story from "we stopped you" to "and you can recover."
3. **Route-handler integration tests** (~1h) — the policy and the converters are tested;
   the HTTP layer is currently verified by a scripted `curl` suite rather than in CI.
4. **Real CRDT collaboration** — only with a sync backend that justifies the cost.

---

## Known limitations

- Two people editing the same document get a conflict banner, not a merge.
- Anyone can sign in as anyone — authentication is a demo, authorization is not.
- Imports above 1 MB are rejected; Vercel caps request bodies around 4.5 MB regardless.
- `.docx` import keeps headings, bold/italic and lists. Tables, images, footnotes and
  tracked changes are dropped — mammoth maps to semantic HTML, not a faithful render.
- Images are resized by preset width, not by dragging. Deleting an image from a document
  leaves its row in `document_assets`; a sweep for unreferenced assets is the follow-up.
- PDF output is whatever the browser's print engine produces, so pagination is not
  precisely controlled.
- On screen, page boundaries are drawn as guides. Text flows continuously in a single
  editor rather than reflowing into discrete page elements. Real pagination means
  measuring laid-out content and re-splitting it on every keystroke — Google Docs runs its
  own layout engine for this. The guides plus a genuinely paginated PDF cover the need at
  a fraction of the cost.
- Demo capacity caps: 50 documents per account, 50 images per document.
- Renames are last-write-wins with no version guard. A single field that both people can
  see is not worth the friction of a conflict dialog.
