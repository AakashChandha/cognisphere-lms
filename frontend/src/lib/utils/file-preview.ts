/** Preview kinds the student UI can render in-browser. */
export type FilePreviewKind = "pdf" | "pptx" | "video";

const PDF_MIME = "application/pdf";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";
/** Containers every modern browser plays natively via <video>. */
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "webm"]);

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

/**
 * Returns which in-browser viewer to use, or `null` when the file is
 * download-only (legacy `.ppt`, images, zip, .mkv/.avi, etc.).
 *
 * Modern PowerPoint (`.pptx`) is previewable; old binary `.ppt` is not.
 * Video is limited to MP4/WebM because those play in every browser without
 * server-side transcoding.
 */
export function getFilePreviewKind(mimeType: string, filename: string): FilePreviewKind | null {
  const ext = getExtension(filename);
  const mime = (mimeType || "").toLowerCase();

  if (mime === PDF_MIME || ext === "pdf") return "pdf";
  if (mime === PPTX_MIME || ext === "pptx") return "pptx";
  if (VIDEO_MIMES.has(mime) || VIDEO_EXTENSIONS.has(ext)) return "video";

  // Legacy .ppt cannot be rendered by the client-side PPTX viewer.
  if (mime === PPT_MIME || ext === "ppt") return null;

  return null;
}

export function canPreviewInBrowser(mimeType: string, filename: string): boolean {
  return getFilePreviewKind(mimeType, filename) !== null;
}
