import { NextResponse } from "next/server";

export type ApiError = { error: string; code: string };

export function jsonError(message: string, status: number, code: string) {
  return NextResponse.json<ApiError>({ error: message, code }, { status });
}

export const unauthenticated = () => jsonError("You are not signed in.", 401, "UNAUTHENTICATED");

/**
 * Used when the caller has no access at all. Deliberately 404 rather than 403:
 * a 403 would confirm that the document exists, letting anyone enumerate ids.
 */
export const notFound = () => jsonError("Document not found.", 404, "NOT_FOUND");

/**
 * Used when the caller can already see the document but lacks permission for
 * this particular action (for example a viewer trying to save). Existence is
 * not a secret from them, so 403 is the honest answer.
 */
export const forbidden = (message = "You do not have permission to do that.") =>
  jsonError(message, 403, "FORBIDDEN");

export const badRequest = (message: string) => jsonError(message, 400, "BAD_REQUEST");

export const conflict = (message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: message, code: "VERSION_CONFLICT", ...extra }, { status: 409 });
