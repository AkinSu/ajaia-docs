import { NextResponse } from "next/server";
import { z } from "zod";
import { canDelete, canEdit } from "@/lib/access";
import { badRequest, conflict, forbidden, notFound, unauthenticated } from "@/lib/api";
import {
  deleteDocument,
  loadDocumentForUser,
  renameDocument,
  saveDocumentContent,
} from "@/lib/documents";
import { getCurrentUserId } from "@/lib/session";
import { isUuid, parseContent, titleSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();

  return NextResponse.json({
    document: found.document,
    role: found.role,
    owner: found.owner,
  });
}

const patchSchema = z
  .object({
    title: titleSchema.optional(),
    content: z.unknown().optional(),
    version: z.number().int().positive().optional(),
  })
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: "Provide a title or content to update.",
  });

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  // Access is re-checked on the server for every write. The UI hiding the
  // toolbar for viewers is a convenience, not the control.
  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();
  if (!canEdit(found.role)) {
    return forbidden("You have view-only access to this document.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid update.");
  }

  let current = found.document;

  if (parsed.data.content !== undefined) {
    if (parsed.data.version === undefined) {
      return badRequest("A version is required when saving content.");
    }

    const content = parseContent(parsed.data.content);
    if (!content.ok) return badRequest(content.error);

    const saved = await saveDocumentContent({
      documentId: id,
      expectedVersion: parsed.data.version,
      content: content.content,
    });

    if (!saved) {
      // Someone else saved since this client loaded. Hand back the server's
      // version so the UI can tell the user instead of overwriting them.
      return conflict("This document was changed somewhere else since you opened it.", {
        document: current,
      });
    }

    current = saved;
  }

  if (parsed.data.title !== undefined) {
    const renamed = await renameDocument(id, parsed.data.title);
    if (!renamed) return notFound();
    current = renamed;
  }

  return NextResponse.json({ document: current });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();
  if (!canDelete(found.role)) {
    return forbidden("Only the owner can delete this document.");
  }

  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
