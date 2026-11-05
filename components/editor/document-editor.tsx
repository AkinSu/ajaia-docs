"use client";

import type { JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShareDialog } from "@/components/share-dialog";
import { Toolbar } from "@/components/editor/toolbar";
import { canEdit, canManageSharing, type AccessRole } from "@/lib/access";
import { editorExtensions } from "@/lib/editor-extensions";
import { formatTime } from "@/lib/format";
import {
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_LABEL,
  SUPPORTED_IMAGE_TYPES,
} from "@/lib/image-constants";

/** How long to wait after the last keystroke before saving. */
const AUTOSAVE_DELAY_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict" | "missing";

type DocumentEditorProps = {
  documentId: string;
  initialTitle: string;
  initialContent: JSONContent;
  initialVersion: number;
  role: AccessRole;
  owner: { name: string; email: string };
  viewerEmail: string;
};

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  initialVersion,
  role,
  owner,
  viewerEmail,
}: DocumentEditorProps) {
  const editable = canEdit(role);

  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const versionRef = useRef(initialVersion);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  // Once a conflict is detected we stop writing entirely. Continuing to save
  // would overwrite whatever the other session wrote.
  const conflictRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: initialContent,
    editable,
    // Required in the App Router: rendering on the server would produce a
    // hydration mismatch against the browser's contenteditable DOM.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: "document-body",
        class: "document-body min-h-[60vh]",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Document body",
        ...(editable ? {} : { "aria-readonly": "true" }),
      },
    },
    onUpdate: () => {
      if (!editable) return;
      dirtyRef.current = true;
      scheduleSave();
    },
  });

  const saveContent = useCallback(async () => {
    if (!editor || !editable || conflictRef.current) return;
    if (!dirtyRef.current) return;

    if (savingRef.current) {
      // A save is already in flight; run once more when it settles so the
      // final keystrokes are never dropped.
      queuedRef.current = true;
      return;
    }

    savingRef.current = true;
    setStatus("saving");
    setErrorMessage(null);

    const content = editor.getJSON();

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, version: versionRef.current }),
      });

      if (response.status === 409) {
        conflictRef.current = true;
        setStatus("conflict");
        return;
      }

      if (response.status === 404) {
        // The document was deleted (or the demo data was reset) while this tab
        // was open. Stop writing and say so plainly rather than retrying
        // against something that no longer exists.
        conflictRef.current = true;
        setStatus("missing");
        return;
      }

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus("error");
        setErrorMessage(body.error ?? "Could not save your changes.");
        return;
      }

      versionRef.current = body.document.version;
      dirtyRef.current = false;
      setSavedAt(new Date());
      setStatus("saved");
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the server. Your changes are not saved yet.");
    } finally {
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void saveContent();
      }
    }
  }, [documentId, editable, editor]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveContent(), AUTOSAVE_DELAY_MS);
  }, [saveContent]);

  // Flush pending edits when the tab is hidden or the user navigates away,
  // so a quick close does not lose the last debounce window.
  useEffect(() => {
    if (!editable) return;

    const flush = () => {
      if (!dirtyRef.current || conflictRef.current || !editor) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      // keepalive lets the request outlive the page.
      void fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editor.getJSON(), version: versionRef.current }),
        keepalive: true,
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [documentId, editable, editor]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveTitle = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === initialTitle) return;
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setErrorMessage(body.error ?? "Could not rename the document.");
          setStatus("error");
          return;
        }
        setSavedAt(new Date());
        setStatus("saved");
      } catch {
        setErrorMessage("Could not rename the document.");
        setStatus("error");
      }
    },
    [documentId, initialTitle],
  );

  const uploadImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setErrorMessage(null);

      if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        setErrorMessage(`Unsupported image type. ${SUPPORTED_IMAGE_LABEL}.`);
        setStatus("error");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setErrorMessage(`That image is larger than the ${MAX_IMAGE_BYTES / 1_000_000} MB limit.`);
        setStatus("error");
        return;
      }

      setImageBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`/api/documents/${documentId}/assets`, {
          method: "POST",
          body: form,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Could not upload that image.");

        editor.chain().focus().setImage({ src: body.url }).run();
        dirtyRef.current = true;
        scheduleSave();
      } catch (caught) {
        setErrorMessage(caught instanceof Error ? caught.message : "Could not upload that image.");
        setStatus("error");
      } finally {
        setImageBusy(false);
        if (imageInput.current) imageInput.current.value = "";
      }
    },
    [documentId, editor, scheduleSave],
  );

  /** Uses the browser's own print dialog, which offers "Save as PDF". */
  const downloadPdf = useCallback(() => window.print(), []);

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <Link
            href="/docs"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Documents
          </Link>

          <div className="min-w-0 flex-1">
            <label htmlFor="document-title" className="sr-only">
              Document title
            </label>
            <input
              id="document-title"
              value={title}
              readOnly={!editable}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={(event) => void saveTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-full truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-slate-900 transition hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none read-only:hover:border-transparent"
            />
          </div>

          <SaveIndicator status={status} savedAt={savedAt} editable={editable} />

          <div className="flex items-center gap-2">
            {role !== "owner" ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {role === "editor" ? "Shared · can edit" : "Shared · view only"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={downloadPdf}
              title="Opens your browser's print dialog, where you can choose Save as PDF"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {canManageSharing(role) ? "Share" : "Who has access"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {status === "conflict" ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-semibold">This document changed somewhere else.</p>
            <p className="mt-1">
              Someone else saved while you were editing, so autosave stopped to avoid
              overwriting their work. Reload to get the latest version. Your current text is
              still on screen — copy anything you need first.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-800"
            >
              Reload document
            </button>
          </div>
        ) : null}

        {status === "missing" ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">This document no longer exists.</p>
            <p className="mt-1">
              It was deleted, or access was removed, while you had it open. Nothing further
              will be saved. Your text is still on screen — copy anything you need before
              leaving this page.
            </p>
            <Link
              href="/docs"
              className="mt-3 inline-flex rounded-lg bg-red-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-800"
            >
              Back to documents
            </Link>
          </div>
        ) : null}

        {!editable ? (
          <p className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            You have view-only access to this document. {owner.name} owns it and can give you
            edit access.
          </p>
        ) : null}

        {errorMessage && status === "error" ? (
          <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </p>
        ) : null}

        {editor && editable ? (
          <div className="no-print mb-4">
            <Toolbar
              editor={editor}
              disabled={status === "conflict" || status === "missing"}
              onInsertImage={() => imageInput.current?.click()}
              imageBusy={imageBusy}
            />
            <input
              ref={imageInput}
              type="file"
              accept={SUPPORTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(file);
              }}
            />
          </div>
        ) : null}

        <div className="document-sheet document-pages rounded-xl border border-slate-200 bg-white px-16 py-20 shadow-sm">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p className="text-sm text-slate-400">Loading editor…</p>
          )}
        </div>
      </main>

      {shareOpen ? (
        <ShareDialog
          documentId={documentId}
          documentTitle={title}
          canManage={canManageSharing(role)}
          owner={owner}
          viewerEmail={viewerEmail}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SaveIndicator({
  status,
  savedAt,
  editable,
}: {
  status: SaveStatus;
  savedAt: Date | null;
  editable: boolean;
}) {
  if (!editable) return null;

  const text =
    status === "saving"
      ? "Saving…"
      : status === "error"
        ? "Not saved"
        : status === "conflict"
          ? "Paused"
          : status === "missing"
            ? "Not saved"
          : status === "saved" && savedAt
            ? `Saved ${formatTime(savedAt)}`
            : "All changes saved";

  const tone =
    status === "error" || status === "conflict" ? "text-amber-700" : "text-slate-500";

  return (
    <span aria-live="polite" className={`shrink-0 text-xs ${tone}`}>
      {text}
    </span>
  );
}
