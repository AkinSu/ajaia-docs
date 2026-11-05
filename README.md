# Ajaia Docs

A lightweight collaborative document editor inspired by Google Docs. Create and format
rich-text documents, import existing files, and share them with other people.

**Live app: https://ajaia-docs-iota-ebon.vercel.app** — no credentials needed, just pick an account.

Built for the Ajaia Full Stack Product Engineer take-home. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the design reasoning and the scope cuts,
[AI_WORKFLOW.md](./AI_WORKFLOW.md) for how AI tools were used, and
[SUBMISSION.md](./SUBMISSION.md) for exactly what is and is not finished.

---

## Try it in two minutes

1. Open the app and pick **Alice Nwosu** on the sign-in screen. There are no passwords —
   authentication is deliberately mocked (see [Scope](#scope)).
2. Open **Q4 Product Plan**. Edit it, apply some formatting, and watch the indicator in
   the header go `Saving… → Saved 4:52 PM`. Refresh: the formatting is still there.
3. Click **Share**, enter `carol@ajaia.test`, choose **View only**, and share.
4. Open an **incognito window** (or a second browser profile), go to the same URL, and
   sign in as **Carol Mehta**. The document now appears under **Shared with me** with a
   *View only* badge, and the editor is read-only for her.
5. Back as Alice, use **Import a file** with any of the files in [`samples/`](./samples)
   to turn a `.md`, `.txt` or `.docx` into a new editable document.

> **Two users at once:** a session cookie belongs to a browser *profile*, not a tab, so
> two tabs in the same window are always the same person. Use an incognito window or a
> second browser profile to be two users simultaneously.

### Seeded accounts

| Account | Email | Starts with |
|---|---|---|
| Alice Nwosu | `alice@ajaia.test` | Owns *Q4 Product Plan* (shared to Bob as editor) and *Launch checklist*. Has view-only access to Bob's notes. |
| Bob Castellano | `bob@ajaia.test` | Owns *Engineering notes* (shared to Alice as viewer). Can edit Alice's plan. |
| Carol Mehta | `carol@ajaia.test` | Nothing — use her to demonstrate a fresh share. |

---

## What it does

**Documents** — create, rename, edit, autosave and reopen. Formatting supports **bold**,
*italic*, <u>underline</u>, headings (H1–H3), and bulleted and numbered lists.

**Images** — insert a picture and set its width to Small, Medium, Large or Full from the
toolbar. **Supported: PNG, JPEG, GIF, WebP up to 2 MB.** Width is stored as a percentage
so pictures scale with the page. An image is exactly as private as the document that
owns it: anyone without access to the document gets a 404 for the image too.

**Download as PDF** — uses the browser's own print dialog ("Save as PDF"), so there is no
dependency and nothing to run server-side. A print stylesheet hides the app chrome.

**Page guides** — a rule is drawn every page height so you can see where pages will break.
This is a visual guide, not true pagination: text flows in one continuous editor rather
than reflowing into separate page elements the way Google Docs does. The exported PDF is
really paginated, by the browser's print engine.

**Demo limits** — 50 documents per account and 50 images per document. This runs on free
infrastructure for a hiring exercise, so the caps stop one visitor filling the database
for everyone else. Nobody evaluating the app will reach them.

**Autosave** — saves 800 ms after you stop typing, and flushes immediately if you hide
the tab or close the page. The header always shows the current save state.

**Conflict handling** — every save carries the document version it was based on. If
someone else saved first, the server rejects the write with `409` and the editor shows a
banner instead of overwriting their work. See
[the architecture note](./ARCHITECTURE.md#concurrent-edits) for why it works this way.

**Sharing** — share by email as **Can edit** or **View only**, change someone's role, or
revoke access. The document list separates **My documents** from **Shared with me**, and
shared rows show the owner and your access level.

**File import** — upload a `.txt`, `.md` or `.docx` and it becomes a new editable
document with its formatting preserved. **Supported types: `.txt`, `.md`/`.markdown` and
`.docx`, up to 1 MB.** Other types are rejected with a clear message. The uploaded file
itself is never stored — it is parsed into document content and discarded.

---

## Running it locally

### Requirements

- Node.js 20 or newer
- A PostgreSQL database. Any of these work:
  - **Docker** (simplest): `docker run -d --name ajaia-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=ajaia -p 55432:5432 postgres:17-alpine`
  - A free [Neon](https://neon.com) database
  - Any local Postgres you already have

### Setup

```bash
git clone https://github.com/AkinSu/ajaia-docs.git
cd ajaia-docs
npm install

cp .env.example .env.local
# edit .env.local - see below

npm run setup    # creates the tables and seeds the demo accounts
npm run dev      # http://localhost:3000
```

`.env.local` needs two values:

```bash
# If you used the Docker command above, this exact line works:
DATABASE_URL="postgresql://postgres:devpass@127.0.0.1:55432/ajaia"

# Any random string of 32+ characters. Generate one with: openssl rand -base64 32
SESSION_SECRET="replace-me-with-at-least-32-random-characters"
```

> Using Neon? Use the **pooled** connection string — the host contains `-pooler`. It
> routes through PgBouncer so serverless functions cannot exhaust Postgres connections.

### Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run setup` | `db:push` + `db:seed` in one step |
| `npm run db:push` | Create/update tables from the schema |
| `npm run db:seed` | Reset and reseed the demo accounts and documents |
| `npm test` | Run the test suite (44 tests) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

---

## Tests

```bash
npm test
```

44 tests covering the two areas where bugs would actually matter:

- **`lib/access.test.ts`** — the complete authorization matrix. Every role
  (owner / editor / viewer / no access) against every action (read / edit / share /
  delete), plus the cases that are easy to get wrong: ownership must survive a
  conflicting share row, and "document missing" and "access denied" must be
  indistinguishable to the caller.
- **`lib/convert.test.ts`** — the import pipeline. Markdown headings, bold and both list
  types survive conversion; a real `.docx` is built and round-tripped; `<script>` tags and
  `onclick` handlers are stripped; oversized, empty and unsupported files are rejected
  with the right error.

CI runs typecheck, lint and tests on every push.

---

## Scope

Built deliberately narrow. What is **not** here, and why:

| Not built | Reasoning |
|---|---|
| Real-time co-editing (CRDT / multiple cursors) | The honest version is days of work, not hours. Version-guarded saves with a visible conflict banner is the defensible answer at this scope — see [ARCHITECTURE.md](./ARCHITECTURE.md#concurrent-edits). |
| Real authentication | The brief explicitly permits mocked auth. Seeded accounts make the sharing flow faster for a reviewer to test, and the time went into access control instead. |
| Comments, suggestions, version history | Each is a feature in its own right. Depth in a few areas beat shallow coverage everywhere. |
| Drag-handle image resizing | Four preset widths cover the need; drag handles are a disproportionate amount of pointer-event code for the same outcome. |
| Tables | Out of the required formatting set. |
| Mobile layout polish | Usable but not tuned below tablet width. |

**Authentication here is a demo, not a security model**: anyone can sign in as anyone.
Authorization *between* accounts is enforced properly on the server, which is the part
that was worth building well.

---

## Stack

Next.js 16 (App Router) · TypeScript · Tiptap 3 · Tailwind CSS 4 · Drizzle ORM ·
PostgreSQL · Vitest · deployed on Vercel with Neon.

---

## Screenshots

**Document list — owned vs. shared, with owner and access level**

![Documents list](./docs/screenshots/01-documents-list.jpg)

**Editor — headings, bold, italic, underline and both list types, with autosave state**

![Editor](./docs/screenshots/02-editor.jpg)
