/**
 * Seeds the three demo accounts and a few documents.
 *
 * Reviewers need a populated app on first load and a sharing relationship that
 * already exists in both directions, so the owned/shared distinction and both
 * share roles are visible without setting anything up.
 */
import { generateJSON } from "@tiptap/html/server";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { editorExtensions } from "../lib/editor-extensions";
import { documentShares, documents, users } from "../lib/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});
const db = drizzle(pool, { schema: { users, documents, documentShares } });

const doc = (html: string) => generateJSON(html, editorExtensions);

const PLAN = `
  <h1>Q4 Product Plan</h1>
  <p>This quarter we focus on <strong>shipping the collaborative editor</strong> and
  cutting onboarding friction. Everything else is explicitly deferred.</p>
  <h2>Priorities</h2>
  <ul>
    <li><strong>Document editing</strong> that feels immediate</li>
    <li><em>Import</em> from existing files so teams can migrate</li>
    <li>Sharing that is obvious at a glance</li>
  </ul>
  <h2>Sequence</h2>
  <ol>
    <li>Rich-text editing and autosave</li>
    <li>File import</li>
    <li>Sharing and permissions</li>
  </ol>
  <p>Open question: how much <u>version history</u> do teams actually need?</p>
`;

const CHECKLIST = `
  <h1>Launch checklist</h1>
  <p>Everything that has to be true before we tell customers.</p>
  <ul>
    <li>Autosave survives a refresh</li>
    <li>Viewers genuinely cannot write</li>
    <li>Imported formatting is preserved</li>
  </ul>
`;

const NOTES = `
  <h1>Engineering notes</h1>
  <p>Storing content as <strong>ProseMirror JSON</strong> rather than HTML keeps
  formatting lossless and keeps untrusted markup out of the render path.</p>
  <h2>Open items</h2>
  <ol>
    <li>Decide on a conflict-resolution story beyond version guards</li>
    <li>Measure autosave latency under a slow connection</li>
  </ol>
`;

async function main() {
  // Reset so the script can be run repeatedly during development.
  await db.delete(documentShares);
  await db.delete(documents);
  await db.delete(users);

  const [alice, bob, carol] = await db
    .insert(users)
    .values([
      { email: "alice@ajaia.test", name: "Alice Nwosu" },
      { email: "bob@ajaia.test", name: "Bob Castellano" },
      { email: "carol@ajaia.test", name: "Carol Mehta" },
    ])
    .returning();

  const [plan, , notes] = await db
    .insert(documents)
    .values([
      { ownerId: alice.id, title: "Q4 Product Plan", content: doc(PLAN) },
      { ownerId: alice.id, title: "Launch checklist", content: doc(CHECKLIST) },
      { ownerId: bob.id, title: "Engineering notes", content: doc(NOTES) },
    ])
    .returning();

  await db.insert(documentShares).values([
    // Bob can edit Alice's plan.
    { documentId: plan.id, userId: bob.id, role: "editor" },
    // Alice can only read Bob's notes, so view-only mode is demonstrable.
    { documentId: notes.id, userId: alice.id, role: "viewer" },
  ]);

  console.log("Seeded 3 users and 3 documents.");
  console.log("  alice@ajaia.test  owns 'Q4 Product Plan' (shared with Bob as editor)");
  console.log("  bob@ajaia.test    owns 'Engineering notes' (shared with Alice as viewer)");
  console.log("  carol@ajaia.test  has nothing yet - use her to test a fresh share");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
