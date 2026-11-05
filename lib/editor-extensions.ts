import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

/**
 * Image node that remembers a display width.
 *
 * Width is stored as a percentage string so the picture scales with the page
 * instead of being pinned to the pixel size of whoever inserted it.
 */
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("width") ?? "100%",
        renderHTML: (attributes) => {
          const width = attributes.width as string | null;
          return width ? { width } : {};
        },
      },
    };
  },
});

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
  ResizableImage.configure({
    inline: false,
    // Only images this app served. A data: or remote URL in hand-crafted
    // content would let a document pull in arbitrary third-party requests.
    allowBase64: false,
  }),
];

/** An empty but schema-valid document. */
export const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;
