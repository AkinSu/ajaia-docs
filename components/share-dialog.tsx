"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Share = { userId: string; name: string; email: string; role: "viewer" | "editor" };

type ShareDialogProps = {
  documentId: string;
  documentTitle: string;
  canManage: boolean;
  owner: { name: string; email: string };
  viewerEmail: string;
  onClose: () => void;
};

export function ShareDialog({
  documentId,
  documentTitle,
  canManage,
  owner,
  viewerEmail,
  onClose,
}: ShareDialogProps) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/shares`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load who has access.");
      setShares(body.shares);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load who has access.");
      setShares([]);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    emailInput.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addShare(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not share the document.");
      setEmail("");
      setNotice(`Shared with ${body.share.email}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not share the document.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(share: Share, nextRole: "viewer" | "editor") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: share.email, role: nextRole }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not change access.");
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change access.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(share: Share) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/documents/${documentId}/shares?userId=${encodeURIComponent(share.userId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not remove access.");
      }
      setNotice(`Removed ${share.email}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-dialog-title" className="text-lg font-semibold text-slate-900">
              {canManage ? "Share document" : "Who has access"}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500">{documentTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {canManage ? (
          <form onSubmit={addShare} className="mt-5 space-y-3">
            <div>
              <label htmlFor="share-email" className="block text-sm font-medium text-slate-700">
                Share with
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  ref={emailInput}
                  id="share-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@ajaia.test"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                <select
                  aria-label="Access level"
                  value={role}
                  onChange={(event) => setRole(event.target.value as "viewer" | "editor")}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">View only</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Demo accounts: alice@ajaia.test, bob@ajaia.test, carol@ajaia.test
              </p>
            </div>
            <button
              type="submit"
              disabled={busy || email.trim().length === 0}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? "Working…" : "Share"}
            </button>
          </form>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">{notice}</p>
        ) : null}

        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            People with access
          </h3>
          <ul className="mt-2 divide-y divide-slate-100">
            <li className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {owner.name}
                  {owner.email === viewerEmail ? " (you)" : ""}
                </span>
                <span className="block truncate text-xs text-slate-500">{owner.email}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-500">Owner</span>
            </li>

            {shares === null ? (
              <li className="py-3 text-sm text-slate-400">Loading…</li>
            ) : shares.length === 0 ? (
              <li className="py-3 text-sm text-slate-500">
                Not shared with anyone else yet.
              </li>
            ) : (
              shares.map((share) => (
                <li key={share.userId} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {share.name}
                      {share.email === viewerEmail ? " (you)" : ""}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{share.email}</span>
                  </span>

                  {canManage ? (
                    <>
                      <select
                        aria-label={`Access level for ${share.email}`}
                        value={share.role}
                        disabled={busy}
                        onChange={(event) =>
                          void changeRole(share, event.target.value as "viewer" | "editor")
                        }
                        className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs focus:border-slate-500 focus:outline-none"
                      >
                        <option value="editor">Can edit</option>
                        <option value="viewer">View only</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void revoke(share)}
                        disabled={busy}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                      {share.role === "editor" ? "Can edit" : "View only"}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
