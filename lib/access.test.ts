import { describe, expect, it } from "vitest";
import {
  canDelete,
  canEdit,
  canManageSharing,
  canRead,
  resolveAccess,
  type AccessRole,
} from "./access";

const OWNER = "11111111-1111-1111-1111-111111111111";
const COLLABORATOR = "22222222-2222-2222-2222-222222222222";
const STRANGER = "33333333-3333-3333-3333-333333333333";

const doc = { ownerId: OWNER };

describe("resolveAccess", () => {
  it("gives the owner the owner role", () => {
    expect(resolveAccess(OWNER, doc, null)).toBe("owner");
  });

  it("keeps ownership even when a share also exists", () => {
    // Ownership must win, or an owner could be demoted by a stray share row
    // and locked out of their own document.
    expect(resolveAccess(OWNER, doc, { role: "viewer" })).toBe("owner");
    expect(resolveAccess(OWNER, doc, { role: "editor" })).toBe("owner");
  });

  it("maps an editor share to the editor role", () => {
    expect(resolveAccess(COLLABORATOR, doc, { role: "editor" })).toBe("editor");
  });

  it("maps a viewer share to the viewer role", () => {
    expect(resolveAccess(COLLABORATOR, doc, { role: "viewer" })).toBe("viewer");
  });

  it("denies a user with no share at all", () => {
    expect(resolveAccess(STRANGER, doc, null)).toBeNull();
    expect(resolveAccess(STRANGER, doc, undefined)).toBeNull();
  });

  it("denies anonymous callers", () => {
    expect(resolveAccess(null, doc, { role: "editor" })).toBeNull();
    expect(resolveAccess(undefined, doc, { role: "editor" })).toBeNull();
    expect(resolveAccess("", doc, { role: "editor" })).toBeNull();
  });

  it("denies access when the document is missing", () => {
    // A missing row and a forbidden row collapse to the same answer so that
    // callers return 404 for both and never leak document existence.
    expect(resolveAccess(OWNER, null, null)).toBeNull();
    expect(resolveAccess(OWNER, undefined, null)).toBeNull();
  });
});

describe("permission matrix", () => {
  const roles: Array<AccessRole | null> = ["owner", "editor", "viewer", null];

  const expected: Record<string, { read: boolean; edit: boolean; share: boolean; remove: boolean }> =
    {
      owner: { read: true, edit: true, share: true, remove: true },
      editor: { read: true, edit: true, share: false, remove: false },
      viewer: { read: true, edit: false, share: false, remove: false },
      none: { read: false, edit: false, share: false, remove: false },
    };

  for (const role of roles) {
    const key = role ?? "none";
    it(`grants the documented permissions to ${key}`, () => {
      expect({
        read: canRead(role),
        edit: canEdit(role),
        share: canManageSharing(role),
        remove: canDelete(role),
      }).toEqual(expected[key]);
    });
  }

  it("never lets a viewer write", () => {
    expect(canEdit("viewer")).toBe(false);
  });

  it("never lets an editor change who has access", () => {
    // Re-sharing is an owner-only action: an editor with sharing rights could
    // widen access beyond what the owner intended.
    expect(canManageSharing("editor")).toBe(false);
  });

  it("never lets a non-owner delete", () => {
    expect(canDelete("editor")).toBe(false);
    expect(canDelete("viewer")).toBe(false);
  });
});
