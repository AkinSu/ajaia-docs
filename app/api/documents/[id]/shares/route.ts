import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageSharing } from "@/lib/access";
import { badRequest, forbidden, notFound, unauthenticated } from "@/lib/api";
import {
  findUserByEmail,
  listShares,
  loadDocumentForUser,
  removeShare,
  upsertShare,
} from "@/lib/documents";
import { getCurrentUserId } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Anyone with access can see who else has access; only the owner can change it. */
export async function GET(_request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();

  return NextResponse.json({ shares: await listShares(id), canManage: canManageSharing(found.role) });
}

const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["viewer", "editor"]).default("editor"),
});

export async function POST(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();
  if (!canManageSharing(found.role)) {
    return forbidden("Only the owner can share this document.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid share request.");
  }

  const recipient = await findUserByEmail(parsed.data.email);
  if (!recipient) {
    return badRequest(`No account found for ${parsed.data.email}.`);
  }
  if (recipient.id === found.document.ownerId) {
    return badRequest("That person already owns this document.");
  }

  const share = await upsertShare({
    documentId: id,
    userId: recipient.id,
    role: parsed.data.role,
  });

  return NextResponse.json(
    { share: { ...share, name: recipient.name, email: recipient.email } },
    { status: 201 },
  );
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();
  if (!canManageSharing(found.role)) {
    return forbidden("Only the owner can change who has access.");
  }

  const target = new URL(request.url).searchParams.get("userId");
  if (!target || !isUuid(target)) return badRequest("A valid userId is required.");

  await removeShare(id, target);
  return NextResponse.json({ ok: true });
}
