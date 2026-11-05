/**
 * Avatar for a seeded demo account.
 *
 * Derived from the email's local part rather than stored on the user row:
 * these are three fixture accounts, and a column plus an upload flow for
 * something no real user can change would be machinery for its own sake.
 * Anything unrecognised falls back to initials.
 */
const SEEDED = new Set(["alice", "bob", "carol"]);

export function avatarUrl(email: string): string | null {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return SEEDED.has(local) ? `/avatars/${local}.png` : null;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
