import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, unauthenticated } from "@/lib/api";
import { createDocument, listDocumentsForUser } from "@/lib/documents";
import { getCurrentUserId } from "@/lib/session";
import { titleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();
  return NextResponse.json(await listDocumentsForUser(userId));
}

const createSchema = z.object({ title: titleSchema.optional() });

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthenticated();

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid document.");
  }

  const created = await createDocument({ ownerId: userId, title: parsed.data.title });
  return NextResponse.json({ document: created }, { status: 201 });
}
