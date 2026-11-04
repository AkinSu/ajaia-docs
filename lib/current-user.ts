import { getUserById } from "./documents";
import { getSession } from "./session";
import type { User } from "./db/schema";

/**
 * Resolves the signed-in user, or null.
 *
 * Returns null when the cookie names an account that no longer exists - for
 * example after the database is reseeded or a demo is redeployed. Checking the
 * user rather than just the cookie is what stops /docs and /login redirecting
 * to each other forever.
 *
 * The stale cookie is deliberately not cleared here: server components cannot
 * write cookies during render. It is harmless, and signing in overwrites it.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return getUserById(session.userId);
}
