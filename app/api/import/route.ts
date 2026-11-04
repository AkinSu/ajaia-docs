import { NextResponse } from "next/server";
import { badRequest, unauthenticated } from "@/lib/api";
import { ConversionError, MAX_UPLOAD_BYTES, convertUpload } from "@/lib/convert";
import { createDocument } from "@/lib/documents";
import { getCurrentUserId } from "@/lib/session";

// mammoth and the ProseMirror schema builder both need Node APIs.
export const runtime = "nodejs";

/**
 * Turns an uploaded .txt, .md or .docx file into a new editable document.
 *
 * The uploaded file itself is deliberately never stored: it is parsed into
 * document JSON in this request and discarded. That removes blob storage, the
 * cost of serving user files, and the attack surface of handing them back out.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Upload a file using multipart/form-data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("No file was uploaded.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return badRequest("That file is larger than the 1 MB limit.");
  }

  try {
    const { title, content } = await convertUpload({
      filename: file.name,
      mimeType: file.type,
      bytes: await file.arrayBuffer(),
    });

    const created = await createDocument({ ownerId: userId, title, content });
    return NextResponse.json({ document: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ConversionError) return badRequest(error.message);
    console.error("Import failed", error);
    return badRequest("That file could not be imported.");
  }
}
