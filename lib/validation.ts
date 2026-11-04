import { getSchema } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { z } from "zod";
import { editorExtensions } from "./editor-extensions";

/** Documents larger than this are rejected rather than stored. */
export const MAX_CONTENT_BYTES = 1_000_000;

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title cannot be empty.")
  .max(200, "Title cannot be longer than 200 characters.");

const markSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

/** Shallow shape check. The real guarantee comes from `parseContent` below. */
export const jsonContentSchema: z.ZodType<JSONContent> = z.lazy(() =>
  z.object({
    type: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(jsonContentSchema).optional(),
    marks: z.array(markSchema).optional(),
    text: z.string().optional(),
  }),
);

const schema = getSchema(editorExtensions);

/**
 * Validates content against the actual ProseMirror schema.
 *
 * This is the security boundary for stored documents: any node type, mark or
 * attribute the editor does not define is rejected here, so a hand-crafted
 * request cannot persist arbitrary markup for another user to open.
 */
export function parseContent(value: unknown): { ok: true; content: JSONContent } | { ok: false; error: string } {
  const shape = jsonContentSchema.safeParse(value);
  if (!shape.success) return { ok: false, error: "Document content is not valid rich-text JSON." };

  const serialized = JSON.stringify(shape.data);
  if (serialized.length > MAX_CONTENT_BYTES) {
    return { ok: false, error: "Document is too large to save (limit 1 MB)." };
  }

  try {
    const node = ProseMirrorNode.fromJSON(schema, shape.data);
    node.check();
    return { ok: true, content: node.toJSON() as JSONContent };
  } catch {
    return { ok: false, error: "Document content does not match the editor schema." };
  }
}

export const uuidSchema = z.string().uuid();

export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
