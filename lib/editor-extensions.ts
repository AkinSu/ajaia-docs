import StarterKit from "@tiptap/starter-kit";

/**
 * The single source of truth for the document schema.
 *
 * Both the browser editor and the server-side import converter build their
 * ProseMirror schema from this exact array. If they diverged, imported
 * documents could contain nodes the editor cannot render.
 *
 * StarterKit v3 already bundles Bold, Italic, Underline, Heading, BulletList,
 * OrderedList and ListItem, which covers every format the brief requires.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
];

/** An empty but schema-valid document. */
export const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;
