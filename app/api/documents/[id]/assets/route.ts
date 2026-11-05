import { NextResponse } from "next/server";
import { canEdit } from "@/lib/access";
import { badRequest, forbidden, notFound, unauthenticated } from "@/lib/api";
import { countAssetsForDocument, createAsset, loadDocumentForUser } from "@/lib/documents";
import { MAX_IMAGES_PER_DOCUMENT } from "@/lib/limits";
import {
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_LABEL,
  SUPPORTED_IMAGE_TYPES,
} from "@/lib/image-constants";
import { getCurrentUserId } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";

/** Uploads an image belonging to one document. Editors and owners only. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const found = await loadDocumentForUser(id, userId);
  if (!found) return notFound();
  if (!canEdit(found.role)) {
    return forbidden("You have view-only access to this document.");
  }

  const existing = await countAssetsForDocument(id);
  if (existing >= MAX_IMAGES_PER_DOCUMENT) {
    return badRequest(`This demo allows ${MAX_IMAGES_PER_DOCUMENT} images per document.`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Upload an image using multipart/form-data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("No image was uploaded.");

  // Both the declared type and the size are checked before anything is stored.
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return badRequest(`Unsupported image type. ${SUPPORTED_IMAGE_LABEL}.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return badRequest(`That image is larger than the ${MAX_IMAGE_BYTES / 1_000_000} MB limit.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const asset = await createAsset({
    documentId: id,
    uploadedBy: userId,
    mimeType: file.type,
    byteSize: bytes.byteLength,
    data: bytes.toString("base64"),
  });

  return NextResponse.json({ url: `/api/assets/${asset.id}` }, { status: 201 });
}
