import type { JSONContent } from "@tiptap/core";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A share grants either read-only or read-write access. Ownership is not a
 * share: it lives on `documents.ownerId`, so an owner can never be demoted or
 * accidentally revoked.
 */
export const shareRole = pgEnum("share_role", ["viewer", "editor"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled document"),
  /**
   * ProseMirror/Tiptap document JSON. Stored structurally rather than as HTML
   * so formatting round-trips exactly and we never render untrusted markup.
   */
  content: jsonb("content").$type<JSONContent>().notNull(),
  /**
   * Incremented on every content write. Clients send the version they loaded;
   * a mismatch means someone else saved first and we return 409 instead of
   * silently overwriting their work.
   */
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentShares = pgTable(
  "document_shares",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: shareRole("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.userId] })],
);

/**
 * Image bytes for pictures placed in a document.
 *
 * Stored in Postgres rather than a blob service: a few small images do not
 * justify another provider, and keeping them in the same row-level security
 * story means serving one is a normal authorization check.
 */
export const documentAssets = pgTable("document_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentShare = typeof documentShares.$inferSelect;
export type DocumentAsset = typeof documentAssets.$inferSelect;
