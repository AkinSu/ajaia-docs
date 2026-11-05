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


/**
 * Deliberately long: a reviewer should be able to see pagination without
 * having to type several pages of text first.
 */
const HANDBOOK = `
  <h1>Team writing handbook</h1>
  <p>A long document, included so that pagination, the page indicator and the
  PDF export are all visible on a document that already exists.</p>
  ${[
    {
      heading: "Why we write things down",
      paragraphs: [
        "Writing forces a decision to become specific. A conversation can end with everyone nodding at a different conclusion; a document cannot. The cost of writing is paid once, by the author, and saved many times over by every reader who would otherwise have had to ask.",
        "The test of a good document is not that it is complete. It is that a reader who was not in the room can act on it without scheduling a meeting to find out what it meant.",
      ],
    },
    {
      heading: "Structure",
      paragraphs: [
        "Lead with the decision or the request. Readers who stop after the first paragraph should still come away with the thing you most needed them to know. Background belongs underneath it, not in front of it.",
        "Headings are navigation, not decoration. If a section heading does not tell a skimming reader what they will find there, it is a label rather than a signpost, and it should be rewritten.",
        "Lists are for things that are genuinely parallel. Prose that has been chopped into bullets to look organised is harder to read than the paragraph it came from, because the connective tissue between the ideas has been thrown away.",
      ],
    },
    {
      heading: "Tone",
      paragraphs: [
        "Write the way you would explain it to a colleague who is competent but busy. That rules out both jargon that excludes and over-explanation that patronises.",
        "Hedging is expensive. If something is uncertain, say what is uncertain and what would resolve it. Blanket qualifiers on every sentence leave the reader unable to tell which parts you are actually unsure about.",
        "Strong claims need evidence attached, not volume. A sentence that says what was measured, and how, persuades more than one that insists.",
      ],
    },
    {
      heading: "Review",
      paragraphs: [
        "Reviewing a document is not proofreading. The first question is whether the argument holds, the second is whether a reader outside the team could follow it, and only the third is whether the prose is clean.",
        "Comments should propose, not just object. An objection without an alternative puts the whole cost of resolution on the author.",
        "Agreeing to disagree in a document is legitimate. Record the disagreement and the reasoning on both sides rather than smoothing it into a consensus nobody holds.",
      ],
    },
    {
      heading: "Maintenance",
      paragraphs: [
        "A document that is wrong is worse than one that does not exist, because it is trusted. When something changes, either update the document or mark it superseded and say where the current version lives.",
        "Most documents should have an owner and a date. Without those, a reader has no way to judge whether what they are reading still reflects reality.",
        "Archive aggressively. A small set of documents people trust is more useful than a large set they have to audit before relying on.",
      ],
    },
  ]
    .map(
      (section) => `
        <h2>${section.heading}</h2>
        ${section.paragraphs.map((text) => `<p>${text}</p>`).join("")}
      `,
    )
    .join("")}
  <h2>In short</h2>
  <ul>
    <li>Lead with the decision</li>
    <li>Write for a competent, busy reader</li>
    <li>Say what is uncertain, and what would settle it</li>
    <li>Give every document an owner and a date</li>
  </ul>
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
      { ownerId: alice.id, title: "Team writing handbook", content: doc(HANDBOOK) },
    ])
    .returning();

  await db.insert(documentShares).values([
    // Bob can edit Alice's plan.
    { documentId: plan.id, userId: bob.id, role: "editor" },
    // Alice can only read Bob's notes, so view-only mode is demonstrable.
    { documentId: notes.id, userId: alice.id, role: "viewer" },
  ]);

  console.log("Seeded 3 users and 4 documents.");
  console.log("  alice@ajaia.test  owns 'Q4 Product Plan' (shared with Bob as editor)");
  console.log("  bob@ajaia.test    owns 'Engineering notes' (shared with Alice as viewer)");
  console.log("  carol@ajaia.test  has nothing yet - use her to test a fresh share");
  console.log("  'Team writing handbook' runs several pages, to show pagination");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
