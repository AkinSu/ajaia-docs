import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { buildSampleDocx } from "../scripts/make-sample-docx";
import {
  ConversionError,
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
  convertUpload,
  htmlToDoc,
  plainTextToHtml,
  titleFromFilename,
} from "./convert";

/* ------------------------------------------------------------------ helpers */

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function md(text: string) {
  return convertUpload({
    filename: "doc.md",
    mimeType: "text/markdown",
    bytes: bytes(text),
  });
}

function txt(text: string) {
  return convertUpload({
    filename: "notes.txt",
    mimeType: "text/plain",
    bytes: bytes(text),
  });
}

/** Every node in the document, depth-first, including the root. */
function walk(node: unknown): JSONContent[] {
  if (!node || typeof node !== "object") return [];
  const current = node as JSONContent;
  const children = Array.isArray(current.content)
    ? current.content.flatMap((child) => walk(child))
    : [];
  return [current, ...children];
}

function nodeTypes(doc: JSONContent): string[] {
  return walk(doc)
    .map((node) => node.type)
    .filter((type): type is string => typeof type === "string");
}

function findType(doc: JSONContent, type: string): JSONContent | undefined {
  return walk(doc).find((node) => node.type === type);
}

function allText(doc: JSONContent | undefined): string {
  return walk(doc)
    .map((node) => (typeof node.text === "string" ? node.text : ""))
    .join("");
}

function markNames(doc: JSONContent): string[] {
  return walk(doc).flatMap((node) =>
    Array.isArray(node.marks)
      ? node.marks.map((mark) => mark.type).filter(Boolean)
      : [],
  );
}

/** Serialised form of the whole tree, for "nothing anywhere" assertions. */
function serialized(doc: JSONContent): string {
  return JSON.stringify(doc);
}

async function expectConversionError(
  promise: Promise<unknown>,
  code: ConversionError["code"],
) {
  await expect(promise).rejects.toBeInstanceOf(ConversionError);
  await expect(promise).rejects.toMatchObject({ code });
}

/* -------------------------------------------------------------------- tests */

describe("module surface", () => {
  it("exposes the documented limits", () => {
    expect(MAX_UPLOAD_BYTES).toBe(1_048_576);
    expect(SUPPORTED_EXTENSIONS).toEqual([
      ".txt",
      ".md",
      ".markdown",
      ".docx",
    ]);
  });
});

describe("markdown conversion", () => {
  it("turns `# Heading` into a level-1 heading node", async () => {
    const { content } = await md("# Heading\n");
    const heading = findType(content, "heading");

    expect(heading).toBeDefined();
    expect(heading?.attrs?.level).toBe(1);
    expect(allText(content)).toContain("Heading");
  });

  it("turns `**bold**` into a bold mark", async () => {
    const { content } = await md("Some **bold** text.\n");

    expect(markNames(content)).toContain("bold");
    const bolded = walk(content).find((node) =>
      node.marks?.some((mark) => mark.type === "bold"),
    );
    expect(bolded?.text).toBe("bold");
  });

  it("turns a dash list into a bulletList with two listItems", async () => {
    const { content } = await md("- a\n- b\n");
    const bulletList = findType(content, "bulletList");

    expect(bulletList).toBeDefined();
    expect(bulletList?.content?.length).toBe(2);
    expect(
      nodeTypes(content).filter((type) => type === "listItem"),
    ).toHaveLength(2);
    expect(allText(content)).toContain("a");
    expect(allText(content)).toContain("b");
  });

  it("turns a numbered list into an orderedList", async () => {
    const { content } = await md("1. x\n2. y\n");
    const orderedList = findType(content, "orderedList");

    expect(orderedList).toBeDefined();
    expect(orderedList?.content?.length).toBe(2);
    expect(nodeTypes(content)).not.toContain("bulletList");
  });

  it("preserves italics and headings of other levels", async () => {
    const { content } = await md("## Sub\n\n_slanted_\n");

    expect(findType(content, "heading")?.attrs?.level).toBe(2);
    expect(markNames(content)).toContain("italic");
  });
});

describe("plain text conversion", () => {
  it("splits blank-line-separated blocks into separate paragraphs", async () => {
    const { content } = await txt("First block.\n\nSecond block.\n");
    const paragraphs = walk(content).filter(
      (node) => node.type === "paragraph",
    );

    expect(paragraphs).toHaveLength(2);
    expect(allText(paragraphs[0])).toBe("First block.");
    expect(allText(paragraphs[1])).toBe("Second block.");
  });

  it("converts single newlines inside a paragraph to hard breaks", async () => {
    const { content } = await txt("line one\nline two\n");
    const paragraphs = walk(content).filter(
      (node) => node.type === "paragraph",
    );

    expect(paragraphs).toHaveLength(1);
    expect(nodeTypes(content)).toContain("hardBreak");
  });

  it("escapes markup so a .txt file cannot inject nodes", async () => {
    const { content } = await txt("<script>alert(1)</script>");

    expect(nodeTypes(content)).not.toContain("script");
    // Nothing but a plain paragraph of text came out the other side, so the
    // only place `<script` appears is inside an inert text node.
    expect(new Set(nodeTypes(content))).toEqual(
      new Set(["doc", "paragraph", "text"]),
    );
    expect(markNames(content)).toEqual([]);
    // The markup survives as literal, inert text.
    expect(allText(content)).toBe("<script>alert(1)</script>");
  });

  it("escapes every dangerous entity in plainTextToHtml", () => {
    const html = plainTextToHtml(`a & b < c > d " e ' f`);

    expect(html).toBe(
      `<p>a &amp; b &lt; c &gt; d &quot; e &#39; f</p>`,
    );
  });

  it("emits one <p> per block with <br> for inner newlines", () => {
    expect(plainTextToHtml("one\ntwo\n\nthree")).toBe(
      "<p>one<br>two</p><p>three</p>",
    );
    expect(plainTextToHtml("   \n\n   ")).toBe("");
  });
});

describe("htmlToDoc sanitisation", () => {
  it("drops script elements and event-handler attributes", () => {
    const doc = htmlToDoc(
      `<h1 onclick="steal()">Title</h1>` +
        `<script>alert('xss')</script>` +
        `<p onmouseover="steal()">Body <b>text</b></p>` +
        `<iframe src="javascript:alert(1)"></iframe>`,
    );

    const types = nodeTypes(doc);
    expect(types).not.toContain("script");
    expect(types).not.toContain("iframe");

    const json = serialized(doc);
    expect(json).not.toContain("onclick");
    expect(json).not.toContain("onmouseover");
    expect(json).not.toContain("script");
    expect(json).not.toContain("alert");

    // The legitimate content is still there.
    expect(findType(doc, "heading")?.attrs?.level).toBe(1);
    expect(allText(doc)).toContain("Title");
    expect(allText(doc)).toContain("Body text");
    expect(markNames(doc)).toContain("bold");
  });

  it("returns a schema-valid empty document for contentless html", () => {
    const doc = htmlToDoc("<script>alert(1)</script>");

    expect(doc.type).toBe("doc");
    expect(Array.isArray(doc.content)).toBe(true);
    expect(doc.content?.length).toBeGreaterThan(0);
    expect(nodeTypes(doc)).not.toContain("script");
  });

  it("returns a schema-valid empty document for an empty string", () => {
    const doc = htmlToDoc("");

    expect(doc).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("validation", () => {
  it("rejects input larger than MAX_UPLOAD_BYTES", async () => {
    await expectConversionError(
      convertUpload({
        filename: "big.md",
        mimeType: "text/markdown",
        bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(0x61),
      }),
      "TOO_LARGE",
    );
  });

  it("accepts input exactly at the limit", async () => {
    const atLimit = new Uint8Array(MAX_UPLOAD_BYTES).fill(0x61);
    const { content } = await convertUpload({
      filename: "exact.txt",
      bytes: atLimit,
    });

    expect(content.type).toBe("doc");
  });

  it("rejects unsupported extensions", async () => {
    await expectConversionError(
      convertUpload({
        filename: "report.pdf",
        mimeType: "application/pdf",
        bytes: bytes("%PDF-1.7"),
      }),
      "UNSUPPORTED_TYPE",
    );
  });

  it("rejects an empty file", async () => {
    await expectConversionError(
      convertUpload({ filename: "empty.txt", bytes: new Uint8Array(0) }),
      "EMPTY_FILE",
    );
  });

  it("rejects a whitespace-only file", async () => {
    await expectConversionError(
      convertUpload({ filename: "blank.md", bytes: bytes("  \n\n\t  \n") }),
      "EMPTY_FILE",
    );
  });

  it("wraps an unreadable .docx as PARSE_FAILED", async () => {
    await expectConversionError(
      convertUpload({
        filename: "broken.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: bytes("this is definitely not a zip archive"),
      }),
      "PARSE_FAILED",
    );
  });

  it("dispatches on extension, not the advisory mime type", async () => {
    // Browsers report .md as text/plain, octet-stream or "" at random.
    const { content } = await convertUpload({
      filename: "brief.md",
      mimeType: "application/octet-stream",
      bytes: bytes("# Still markdown\n"),
    });

    expect(findType(content, "heading")?.attrs?.level).toBe(1);
  });

  it("matches extensions case-insensitively", async () => {
    const { content } = await convertUpload({
      filename: "SHOUTING.MD",
      bytes: bytes("# Loud\n"),
    });

    expect(findType(content, "heading")).toBeDefined();
  });
});

describe("titleFromFilename", () => {
  it("humanises separators and strips the extension", () => {
    expect(titleFromFilename("My_Q4-plan.md")).toBe("My Q4 plan");
  });

  it("strips directories", () => {
    expect(titleFromFilename("/tmp/uploads/Launch_brief.docx")).toBe(
      "Launch brief",
    );
  });

  it("falls back when nothing usable remains", () => {
    expect(titleFromFilename(".md")).toBe("Imported document");
    expect(titleFromFilename("___.txt")).toBe("Imported document");
    expect(titleFromFilename("")).toBe("Imported document");
  });

  it("caps the title at 120 characters", () => {
    const title = titleFromFilename(`${"a".repeat(200)}.txt`);
    expect(title).toHaveLength(120);
  });

  it("prefers a markdown file's first H1 over the filename", async () => {
    const { title } = await convertUpload({
      filename: "untitled-1.md",
      bytes: bytes("# Real Title\n\nSome body copy.\n"),
    });

    expect(title).toBe("Real Title");
  });

  it("falls back to the filename when markdown has no H1", async () => {
    const { title } = await convertUpload({
      filename: "my_notes.md",
      bytes: bytes("## Only a sub-heading\n\nBody.\n"),
    });

    expect(title).toBe("my notes");
  });

  it("uses the filename for plain text even if it looks like a heading", async () => {
    const { title } = await convertUpload({
      filename: "raw_notes.txt",
      bytes: bytes("# not a heading\n"),
    });

    expect(title).toBe("raw notes");
  });
});

describe(".docx round trip", () => {
  it("imports a real .docx, keeping the heading, bold run and list", async () => {
    const docx = await buildSampleDocx();
    const { title, content } = await convertUpload({
      filename: "sample.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: new Uint8Array(docx),
    });

    expect(title).toBe("sample");

    const heading = findType(content, "heading");
    expect(heading?.attrs?.level).toBe(1);
    expect(allText(heading)).toBe("Sample Imported Document");

    // A bold run survived as a bold mark on the right text.
    const bolded = walk(content).find((node) =>
      node.marks?.some((mark) => mark.type === "bold"),
    );
    expect(bolded?.text).toBe("bold run");

    // And the bulleted list came through as a real bulletList.
    const bulletList = findType(content, "bulletList");
    expect(bulletList).toBeDefined();
    expect(bulletList?.content?.length).toBe(3);

    expect(nodeTypes(content)).not.toContain("script");
  });
});
