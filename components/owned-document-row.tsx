"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRelativeTime } from "@/lib/format";

type OwnedDocument = {
  id: string;
  title: string;
  updatedAt: string;
  shareCount: number;
};

export function OwnedDocumentRow({ document }: { document: OwnedDocument }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not delete the document.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the document.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li className="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <Link href={`/docs/${document.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900 group-hover:text-blue-700">
          {document.title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Edited {formatRelativeTime(document.updatedAt)}
          {document.shareCount > 0
            ? ` · shared with ${document.shareCount} ${document.shareCount === 1 ? "person" : "people"}`
            : null}
        </span>
      </Link>

      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}

      {confirming ? (
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
        >
          Delete
        </button>
      )}
    </li>
  );
}
