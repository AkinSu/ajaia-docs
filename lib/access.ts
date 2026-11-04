/**
 * Authorization policy.
 *
 * Deliberately pure and database-free: every rule lives here and is exhaustively
 * unit tested, while the route handlers only load rows and ask this module what
 * the caller may do. Nothing in the UI is trusted to enforce access.
 */

export type AccessRole = "owner" | "editor" | "viewer";

export type DocumentLike = { ownerId: string };
export type ShareLike = { role: "viewer" | "editor" } | null | undefined;

/**
 * Returns the caller's effective role, or null when they have no access at all.
 *
 * Ownership wins over any share, so an owner who somehow also has a viewer
 * share cannot be locked out of their own document.
 */
export function resolveAccess(
  userId: string | null | undefined,
  document: DocumentLike | null | undefined,
  share: ShareLike,
): AccessRole | null {
  if (!userId || !document) return null;
  if (document.ownerId === userId) return "owner";
  if (share?.role === "editor") return "editor";
  if (share?.role === "viewer") return "viewer";
  return null;
}

/** Any level of access can read. */
export function canRead(role: AccessRole | null): boolean {
  return role !== null;
}

/** Owners and editors may change content and the title. Viewers may not. */
export function canEdit(role: AccessRole | null): boolean {
  return role === "owner" || role === "editor";
}

/** Only the owner may grant, change or revoke access. */
export function canManageSharing(role: AccessRole | null): boolean {
  return role === "owner";
}

/** Only the owner may delete the document. */
export function canDelete(role: AccessRole | null): boolean {
  return role === "owner";
}
