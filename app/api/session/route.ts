import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { findUserByEmail, getUserById } from "@/lib/documents";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const loginSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
  })
  .refine((value) => Boolean(value.userId ?? value.email), {
    message: "Provide either a userId or an email.",
  });

/** Mocked sign-in: pick one of the seeded accounts. No passwords by design. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid sign-in request.");
  }

  const user = parsed.data.userId
    ? await getUserById(parsed.data.userId)
    : await findUserByEmail(parsed.data.email!);

  if (!user) return badRequest("That account does not exist.");

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
