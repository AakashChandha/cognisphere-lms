/** Preview kinds the student UI can render in-browser. */
export type FilePreviewKind = "pdf" | "pptx";

const PDF_MIME = "application/pdf";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

/**
 * Returns which in-browser viewer to use, or `null` when the file is
 * download-only (legacy `.ppt`, images, zip, etc.).
 *
 * Modern PowerPoint (`.pptx`) is previewable; old binary `.ppt` is not.
 */
export function getFilePreviewKind(mimeType: string, filename: string): FilePreviewKind | null {
  const ext = getExtension(filename);
  const mime = (mimeType || "").toLowerCase();

  if (mime === PDF_MIME || ext === "pdf") return "pdf";
  if (mime === PPTX_MIME || ext === "pptx") return "pptx";

  // Legacy .ppt cannot be rendered by the client-side PPTX viewer.
  if (mime === PPT_MIME || ext === "ppt") return null;

  return null;
}

export function canPreviewInBrowser(mimeType: string, filename: string): boolean {
  return getFilePreviewKind(mimeType, filename) !== null;
}
