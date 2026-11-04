/**
 * Upload limits, kept in their own module with no Node-only imports.
 *
 * The browser needs these to label the import control, but lib/convert.ts
 * pulls in mammoth and happy-dom, which must never reach the client bundle.
 */

/** Hard ceiling on upload size. Anything larger is rejected before parsing. */
export const MAX_UPLOAD_BYTES = 1_048_576; // 1 MB

export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".markdown", ".docx"] as const;

export const SUPPORTED_LABEL = "Supports .txt, .md and .docx files up to 1 MB";
