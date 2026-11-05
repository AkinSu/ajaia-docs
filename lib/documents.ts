import type { JSONContent } from "@tiptap/core";
import { and, desc, eq, sql } from "drizzle-orm";
import { resolveAccess, type AccessRole } from "./access";
import { getDb } from "./db";
import { documentAssets, documentShares, documents, users } from "./db/schema";
import { EMPTY_DOC } from "./editor-extensions";

export type DocumentWithAccess = {
  document: typeof documents.$inferSelect;
  role: AccessRole;
  owner: { id: string; name: string; email: string };
};

/**
 * Loads a document together with the caller's effective role, or null when the
 * caller has no access. Callers translate null into a 404 so that document
 * existence is never leaked.
 */
export async function loadDocumentForUser(
  documentId: string,
  userId: string,
): Promise<DocumentWithAccess | null> {
  const db = getDb();
  const rows = await db
    .select({
      document: documents,
      share: documentShares,
      owner: { id: users.id, name: users.name, email: users.email },
    })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.ownerId))
    .leftJoin(
      documentShares,
      and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)),
    )
    .where(eq(documents.id, documentId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const role = resolveAccess(userId, row.document, row.share);
  if (!role) return null;

  return { document: row.document, role, owner: row.owner };
}

export async function listDocumentsForUser(userId: string) {
  const db = getDb();

  const owned = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      shareCount: sql<number>`(
        select count(*)::int from ${documentShares}
        where ${documentShares.documentId} = ${documents.id}
      )`,
    })
    .from(documents)
    .where(eq(documents.ownerId, userId))
    .orderBy(desc(documents.updatedAt));

  const shared = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      role: documentShares.role,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .innerJoin(users, eq(users.id, documents.ownerId))
    .where(eq(documentShares.userId, userId))
    .orderBy(desc(documents.updatedAt));

  return { owned, shared };
}

export async function createDocument(input: {
  ownerId: string;
  title?: string;
  content?: JSONContent;
}) {
  const db = getDb();
  const [created] = await db
    .insert(documents)
    .values({
      ownerId: input.ownerId,
      title: input.title ?? "Untitled document",
      content: input.content ?? (EMPTY_DOC as unknown as JSONContent),
    })
    .returning();
  return created;
}

/**
 * Writes content only if the row is still at `expectedVersion`.
 *
 * Returns null when nothing matched, which means another session saved first.
 * The caller turns that into a 409 and hands the client the server's current
 * state; we never retry automatically, because that is exactly how one
 * collaborator's work gets silently discarded.
 */
export async function saveDocumentContent(input: {
  documentId: string;
  expectedVersion: number;
  content: JSONContent;
}) {
  const db = getDb();
  const [updated] = await db
    .update(documents)
    .set({
      content: input.content,
      version: sql`${documents.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, input.documentId), eq(documents.version, input.expectedVersion)))
    .returning();
  return updated ?? null;
}

export async function renameDocument(documentId: string, title: string) {
  const db = getDb();
  const [updated] = await db
    .update(documents)
    .set({ title, updatedAt: new Date() })
    .where(eq(documents.id, documentId))
    .returning();
  return updated ?? null;
}

export async function deleteDocument(documentId: string) {
  const db = getDb();
  await db.delete(documents).where(eq(documents.id, documentId));
}

export async function listShares(documentId: string) {
  const db = getDb();
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: documentShares.role,
    })
    .from(documentShares)
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(eq(documentShares.documentId, documentId));
}

export async function findUserByEmail(email: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

export async function upsertShare(input: {
  documentId: string;
  userId: string;
  role: "viewer" | "editor";
}) {
  const db = getDb();
  const [share] = await db
    .insert(documentShares)
    .values(input)
    .onConflictDoUpdate({
      target: [documentShares.documentId, documentShares.userId],
      set: { role: input.role },
    })
    .returning();
  return share;
}

export async function removeShare(documentId: string, userId: string) {
  const db = getDb();
  await db
    .delete(documentShares)
    .where(and(eq(documentShares.documentId, documentId), eq(documentShares.userId, userId)));
}

export async function listUsers() {
  const db = getDb();
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(users.name);
}

export async function getUserById(id: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function createAsset(input: {
  documentId: string;
  uploadedBy: string;
  mimeType: string;
  byteSize: number;
  data: string;
}) {
  const db = getDb();
  const [asset] = await db.insert(documentAssets).values(input).returning();
  return asset;
}

export async function getAsset(assetId: string) {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(documentAssets)
    .where(eq(documentAssets.id, assetId))
    .limit(1);
  return asset ?? null;
}

/** Documents a user owns. Shared documents do not count against their cap. */
export async function countDocumentsOwnedBy(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.ownerId, userId));
  return row?.count ?? 0;
}

export async function countAssetsForDocument(documentId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentAssets)
    .where(eq(documentAssets.documentId, documentId));
  return row?.count ?? 0;
}
