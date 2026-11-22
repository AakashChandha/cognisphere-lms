/**
 * Repairs a PPTX package before it is handed to pptx-preview.
 *
 * pptx-preview walks every <Override> in [Content_Types].xml and calls
 * `zip.files[part].async()` without checking the part exists. Decks generated
 * by PptxGenJS (and some other tools) declare slideMaster1..N.xml but ship only
 * slideMaster1.xml, so that call throws, the loader swallows it, no slides load
 * and the renderer then crashes on `slides[0].background`.
 *
 * PowerPoint itself ignores such dangling overrides, so dropping them changes
 * nothing about how the deck looks. A package with nothing to fix is returned
 * as the original buffer, untouched.
 */
import JSZip from "jszip";

const CONTENT_TYPES = "[Content_Types].xml";

/** Matches both `<Override ... />` and `<Override ...></Override>`. */
const OVERRIDE = /<Override\b[^>]*?(?:\/>|>\s*<\/Override\s*>)/g;
const PART_NAME = /\bPartName\s*=\s*(["'])(.*?)\1/;

/** Returns the part names (without leading "/") of overrides that point at nothing. */
export function findDanglingOverrides(contentTypesXml: string, hasPart: (path: string) => boolean): string[] {
  const missing: string[] = [];
  for (const match of contentTypesXml.matchAll(OVERRIDE)) {
    const partName = PART_NAME.exec(match[0])?.[2];
    if (!partName) continue;
    const path = decodeURIComponent(partName.replace(/^\//, ""));
    if (!hasPart(path)) missing.push(path);
  }
  return missing;
}

export async function sanitizePptx(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // Not a readable zip: let the viewer report it in its own words.
    return buffer;
  }

  const contentTypesFile = zip.file(CONTENT_TYPES);
  if (!contentTypesFile) return buffer;

  const xml = await contentTypesFile.async("string");
  // Zip entry names are case-sensitive, but OPC part names are not.
  const parts = new Set(
    Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir)
      .map((name) => name.toLowerCase()),
  );
  const hasPart = (path: string) => parts.has(path.toLowerCase());

  if (findDanglingOverrides(xml, hasPart).length === 0) return buffer;

  const cleaned = xml.replace(OVERRIDE, (override) => {
    const partName = PART_NAME.exec(override)?.[2];
    if (!partName) return override;
    return hasPart(decodeURIComponent(partName.replace(/^\//, ""))) ? override : "";
  });

  zip.file(CONTENT_TYPES, cleaned);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
