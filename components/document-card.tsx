"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRelativeTime } from "@/lib/format";
import type { PreviewBlock } from "@/lib/preview";

/** A miniature of the document, in the spirit of a Google Docs thumbnail. */
function Thumbnail({ blocks }: { blocks: PreviewBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Empty document
      </div>
    );
  }

  return (
    <div className="space-y-[3px] px-4 pt-4 text-[5.5px] leading-[1.5] text-slate-700">
      {blocks.map((block, index) => {
        if (block.kind === "h1") {
          return (
            <p key={index} className="pt-1 text-[9px] font-bold leading-tight text-slate-900">
              {block.text}
            </p>
          );
        }
        if (block.kind === "h2" || block.kind === "h3") {
          return (
            <p key={index} className="pt-1 text-[7px] font-semibold leading-tight text-slate-900">
              {block.text}
            </p>
          );
        }
        if (block.kind === "li") {
          return (
            <p key={index} className="pl-2">
              • {block.text}
            </p>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

type CardProps = {
  id: string;
  title: string;
  updatedAt: string;
  blocks: PreviewBlock[];
  /** Shown bottom-right: a share count for owned docs, a role for shared ones. */
  badge?: { text: string; tone: "neutral" | "green" } | null;
  subtitle?: string | null;
  deletable?: boolean;
};

export function DocumentCard({
  id,
  title,
  updatedAt,
  blocks,
  badge,
  subtitle,
  deletable = false,
}: CardProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Link
      href={`/docs/${id}`}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-500 hover:shadow-md"
    >
      {/* Preview, in roughly the proportions of a page. */}
      <div className="relative h-44 overflow-hidden border-b border-slate-100 bg-white">
        <Thumbnail blocks={blocks} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Name and metadata sit underneath, the way Docs does it. */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-blue-600 text-[8px] font-bold text-white">
          D
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-blue-700">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {subtitle ? `${subtitle} · ` : ""}
            {formatRelativeTime(updatedAt)}
          </span>
        </span>

        {badge ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              badge.tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {badge.text}
          </span>
        ) : null}

        {deletable ? (
          confirming ? (
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
              >
                {busy ? "…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  setConfirming(false);
                }}
                className="rounded px-1 py-0.5 text-[10px] text-slate-500"
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Delete ${title}`}
              onClick={(event) => {
                event.preventDefault();
                setConfirming(true);
              }}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-red-600"
            >
              ✕
            </button>
          )
        ) : null}
      </div>
    </Link>
  );
}
