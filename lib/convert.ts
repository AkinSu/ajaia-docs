import type { JSONContent } from "@tiptap/core";
// IMPORTANT: the `/server` entry point. The bare `@tiptap/html` default export
// throws "generateJSON can only be used in a browser environment" when called
// from Node, which is where every import runs.
import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { marked } from "marked";

import { EMPTY_DOC, editorExtensions } from "./editor-extensions";
import {
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_LABEL,
} from "./upload-constants";

// Limits live in a client-safe module and are re-exported here so existing
// server-side imports keep working.
export {
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_LABEL,
} from "./upload-constants";

export type ConversionResult = { title: string; content: JSONContent };

export type ConversionErrorCode =
  | "UNSUPPORTED_TYPE"
  | "TOO_LARGE"
  | "EMPTY_FILE"
  | "PARSE_FAILED";

export class ConversionError extends Error {
  constructor(
    message: string,
    public code: ConversionErrorCode,
  ) {
    super(message);
    this.name = "ConversionError";
  }
}

const MAX_TITLE_LENGTH = 120;
const FALLBACK_TITLE = "Imported document";

/**
 * Convert an HTML fragment into a Tiptap/ProseMirror JSON document.
 *
 * SECURITY: this is the single sanitisation choke point for imports. We never
 * hand raw HTML to the editor or store it. `generateJSON` parses the HTML
 * against the ProseMirror schema built from `editorExtensions`, and ProseMirror
 * *discards anything the schema does not define*: `<script>` and `<style>`
 * elements, `onclick`/`onerror` and every other event-handler attribute,
 * `javascript:` wrappers, iframes, and unknown tags all fall away, leaving only
 * schema nodes and marks. That is why every format below is funnelled through
 * HTML into this function rather than being mapped to JSON directly.
 */
export function htmlToDoc(html: string): JSONContent {
  const doc = generateJSON(html, editorExtensions) as JSONContent;

  // A document with no content nodes is not renderable by the editor, so fall
  // back to the known-valid empty document shape.
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) {
    // Deep clone so callers can never mutate the shared constant.
    return JSON.parse(JSON.stringify(EMPTY_DOC)) as JSONContent;
  }

  return doc;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Turn plain text into paragraph HTML.
 *
 * Blank lines separate paragraphs; single newlines inside a paragraph become
 * `<br>`. All text is entity-escaped first, so a .txt file containing markup
 * (or a `<script>` tag) is preserved as literal text and can never inject
 * nodes into the document.
 */
export function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const blocks = normalized
    .split(/\n[ \t]*\n+/)
    .map((block) => block.replace(/^\n+|\n+$/g, ""))
    .filter((block) => block.trim().length > 0);

  if (blocks.length === 0) return "";

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Derive a human-readable title from an upload's filename: drop the directory
 * and extension, turn separators into spaces, collapse whitespace, cap the
 * length, and fall back to a generic title when nothing usable remains.
 */
export function titleFromFilename(filename: string): string {
  const base = (filename ?? "").split(/[\\/]/).pop() ?? "";
  // Drop the trailing extension. A name that is nothing but an extension
  // (".md") leaves an empty stem, which falls through to FALLBACK_TITLE.
  const withoutExtension = base.replace(/\.[^.]*$/, "");

  const cleaned = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return FALLBACK_TITLE;

  return cleaned.slice(0, MAX_TITLE_LENGTH).trim() || FALLBACK_TITLE;
}

function collectText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map((child) => collectText(child)).join("");
}

/** Text of the first level-1 heading in the document, if there is one. */
function firstHeadingText(doc: JSONContent): string | null {
  const stack: JSONContent[] = Array.isArray(doc.content)
    ? [...doc.content]
    : [];

  while (stack.length > 0) {
    const node = stack.shift() as JSONContent;
    if (node?.type === "heading" && node.attrs?.level === 1) {
      const text = collectText(node).replace(/\s+/g, " ").trim();
      if (text) return text.slice(0, MAX_TITLE_LENGTH).trim();
    }
    if (Array.isArray(node?.content)) stack.unshift(...node.content);
  }

  return null;
}

function extensionOf(filename: string): string {
  const base = (filename ?? "").split(/[\\/]/).pop() ?? "";
  // A dotfile-style name (".md") counts as that extension: there is no stem to
  // dispatch on, and rejecting it as "unsupported" would be misleading.
  const match = /(\.[^.]*)$/.exec(base);
  return match ? match[1].toLowerCase() : "";
}

function toUint8(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function decodeText(bytes: Uint8Array): string {
  // `fatal: false` so a stray invalid byte degrades to U+FFFD instead of
  // failing the whole import.
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/^﻿/, "");
}

/**
 * Validate and convert an uploaded file into a document the editor can render.
 *
 * Dispatch is by file **extension** (case-insensitive). `mimeType` is advisory
 * only: browsers report Markdown inconsistently as `text/markdown`,
 * `text/plain`, `application/octet-stream` or an empty string, so trusting it
 * would reject perfectly good .md files.
 */
export async function convertUpload(input: {
  filename: string;
  mimeType?: string | null;
  bytes: ArrayBuffer | Uint8Array;
}): Promise<ConversionResult> {
  const { filename } = input;
  const bytes = toUint8(input.bytes);

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ConversionError(
      `File is too large. The maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB.`,
      "TOO_LARGE",
    );
  }

  const extension = extensionOf(filename);
  if (
    !(SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    throw new ConversionError(
      `Unsupported file type${extension ? ` "${extension}"` : ""}. ${SUPPORTED_LABEL}.`,
      "UNSUPPORTED_TYPE",
    );
  }

  if (bytes.byteLength === 0) {
    throw new ConversionError("The file is empty.", "EMPTY_FILE");
  }

  const isMarkdown = extension === ".md" || extension === ".markdown";
  let html: string;

  if (extension === ".docx") {
    let result: { value: string };
    try {
      result = await mammoth.convertToHtml({
        // mammoth's Node path needs a real Buffer.
        buffer: Buffer.from(bytes),
      });
    } catch {
      throw new ConversionError(
        "Could not read this .docx file. It may be corrupt or password protected.",
        "PARSE_FAILED",
      );
    }
    html = result.value ?? "";
    if (!stripTags(html)) {
      throw new ConversionError("The file is empty.", "EMPTY_FILE");
    }
  } else {
    const text = decodeText(bytes);
    if (!text.trim()) {
      throw new ConversionError("The file is empty.", "EMPTY_FILE");
    }

    if (isMarkdown) {
      try {
        // marked v18's `parse` is typed as `string | Promise<string>`; the
        // explicit `async: false` selects the synchronous overload.
        html = marked.parse(text, { async: false }) as string;
      } catch {
        throw new ConversionError(
          "Could not parse this Markdown file.",
          "PARSE_FAILED",
        );
      }
    } else {
      html = plainTextToHtml(text);
    }
  }

  let content: JSONContent;
  try {
    content = htmlToDoc(html);
  } catch {
    throw new ConversionError(
      "Could not convert this file into a document.",
      "PARSE_FAILED",
    );
  }

  // Markdown files conventionally open with their own title; prefer it over
  // the filename when present.
  const headingTitle = isMarkdown ? firstHeadingText(content) : null;
  const title = headingTitle ?? titleFromFilename(filename);

  return { title, content };
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}
