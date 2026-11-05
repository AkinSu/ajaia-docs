import { notFound, unauthenticated } from "@/lib/api";
import { getAsset, loadDocumentForUser } from "@/lib/documents";
import { getCurrentUserId } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Serves an image.
 *
 * Access is the access of the document the image belongs to, so a picture in a
 * private document is exactly as private as the document. Anything else and
 * sharing a document would silently leak its images to the whole internet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  const { assetId } = await params;
  if (!isUuid(assetId)) return notFound();

  const asset = await getAsset(assetId);
  if (!asset) return notFound();

  const access = await loadDocumentForUser(asset.documentId, userId);
  if (!access) return notFound();

  const bytes = Buffer.from(asset.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(bytes.byteLength),
      // Private: it is per-user authorized, so shared caches must not keep it.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
