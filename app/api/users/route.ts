import { NextResponse } from "next/server";
import { listUsers } from "@/lib/documents";

export const runtime = "nodejs";

/**
 * The seeded accounts, used by the sign-in screen and the share dialog.
 * Safe to expose because these are demo accounts with no credentials.
 */
export async function GET() {
  return NextResponse.json({ users: await listUsers() });
}
