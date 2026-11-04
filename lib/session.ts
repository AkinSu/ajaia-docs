import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = { userId?: string };

const secret = process.env.SESSION_SECRET;

export const sessionOptions = {
  // iron-session requires >= 32 characters. The fallback keeps `next build`
  // working before the real secret is configured; it is never used in
  // production because SESSION_SECRET is set there.
  password: secret && secret.length >= 32 ? secret : "build-time-placeholder-secret-not-for-use",
  cookieName: "ajaia_docs_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** The signed-in user id, or null. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session.userId ?? null;
}
