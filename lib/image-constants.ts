/** Client-safe image limits, imported by both the browser and route handlers. */
export const MAX_IMAGE_BYTES = 2_000_000; // 2 MB

export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export const SUPPORTED_IMAGE_LABEL = "PNG, JPEG, GIF or WebP up to 2 MB";

/** The widths offered in the editor. Stored on the node as a percentage. */
export const IMAGE_WIDTHS = [
  { label: "Small", value: "25%" },
  { label: "Medium", value: "50%" },
  { label: "Large", value: "75%" },
  { label: "Full", value: "100%" },
] as const;
