import type { JSONContent } from "@tiptap/core";

export type PreviewBlock = { kind: "h1" | "h2" | "h3" | "li" | "p"; text: string };

/**
 * Flattens document JSON into a handful of lines for the thumbnail on the
 * document list. Rendering the real editor into every card would be far more
 * machinery than a preview is worth.
 */
export function previewBlocks(content: JSONContent | null | undefined, limit = 14): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];

  const textOf = (node: JSONContent): string => {
    if (typeof node.text === "string") return node.text;
    return (node.content ?? []).map(textOf).join("");
  };

  const walk = (node: JSONContent) => {
    if (blocks.length >= limit) return;

    switch (node.type) {
      case "heading": {
        const level = Number(node.attrs?.level ?? 1);
        const text = textOf(node).trim();
        if (text) blocks.push({ kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text });
        return;
      }
      case "paragraph": {
        const text = textOf(node).trim();
        if (text) blocks.push({ kind: "p", text });
        return;
      }
      case "listItem": {
        const text = textOf(node).trim();
        if (text) blocks.push({ kind: "li", text });
        return;
      }
      case "image": {
        blocks.push({ kind: "p", text: "🖼" });
        return;
      }
    }

    for (const child of node.content ?? []) walk(child);
  };

  if (content) walk(content);
  return blocks;
}
