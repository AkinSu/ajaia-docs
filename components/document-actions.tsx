"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SUPPORTED_LABEL } from "@/lib/upload-constants";

export function DocumentActions() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"create" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createDocument() {
    setError(null);
    setBusy("create");
    try {
      const response = await fetch("/api/documents", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create the document.");
      router.push(`/docs/${body.document.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the document.");
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setError(null);
    setBusy("import");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not import that file.");
      router.push(`/docs/${body.document.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import that file.");
      setBusy(null);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={createDocument}
          disabled={busy !== null}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {busy === "create" ? "Creating…" : "New document"}
        </button>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          title={SUPPORTED_LABEL}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "import" ? "Importing…" : "Import a file"}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.markdown,.docx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
      </div>

      <p className="text-xs text-slate-500">{SUPPORTED_LABEL}</p>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
