/**
 * Slide narration helpers for the PPTX viewer: per-slide text extraction from
 * the deck bytes (jszip + DOMParser, no extra parser) and a small wrapper over
 * the Web Speech API that queues sentence-sized utterances.
 */
import JSZip from "jszip";

export interface SlideNarration {
  /** Text to read for the slide; empty when the slide has nothing to say. */
  text: string;
  /** True when the text came from the speaker notes rather than the slide body. */
  fromNotes: boolean;
}

const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PRESENTATION_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

const SLIDE_FILE = /^ppt\/slides\/slide(\d+)\.xml$/;

/** Paragraphs are joined with ". " unless they already end in punctuation. */
const ENDS_WITH_PUNCTUATION = /[.!?:;,…]["')\]]?$/;

/** Longest chunk handed to one utterance (Chrome cuts long utterances off). */
const MAX_CHUNK_CHARS = 200;

function isSlideNumberShape(paragraph: Element): boolean {
  let node: Element | null = paragraph.parentElement;
  while (node) {
    if (node.localName === "sp") {
      const placeholders = node.getElementsByTagNameNS(PRESENTATION_NS, "ph");
      for (let i = 0; i < placeholders.length; i++) {
        if (placeholders[i].getAttribute("type") === "sldNum") return true;
      }
      return false;
    }
    node = node.parentElement;
  }
  return false;
}

/** Collect the readable text of a slide or notes slide XML document. */
function extractTextFromXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return "";

  const paragraphs = doc.getElementsByTagNameNS(DRAWING_NS, "p");
  const parts: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (isSlideNumberShape(paragraph)) continue;

    let text = "";
    const runs = paragraph.getElementsByTagNameNS(DRAWING_NS, "t");
    for (let j = 0; j < runs.length; j++) text += runs[j].textContent ?? "";
    text = text.replace(/\s+/g, " ").trim();
    if (!text || /^\d+$/.test(text)) continue;

    parts.push(text);
  }

  let out = "";
  for (const part of parts) {
    if (!out) {
      out = part;
    } else if (ENDS_WITH_PUNCTUATION.test(out)) {
      out += ` ${part}`;
    } else {
      out += `. ${part}`;
    }
  }
  return out;
}

/** Resolve the notes slide path for a slide via its .rels, else by number. */
async function findNotesPath(zip: JSZip, slideNumber: number): Promise<string | null> {
  const relsFile = zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`);
  if (relsFile) {
    try {
      const doc = new DOMParser().parseFromString(await relsFile.async("string"), "application/xml");
      const rels = doc.getElementsByTagNameNS(RELS_NS, "Relationship");
      for (let i = 0; i < rels.length; i++) {
        const type = rels[i].getAttribute("Type") ?? "";
        const target = rels[i].getAttribute("Target") ?? "";
        if (type.endsWith("/notesSlide") && target) {
          // Targets are relative to ppt/slides/, e.g. "../notesSlides/notesSlide1.xml".
          const resolved = target.startsWith("/") ? target.slice(1) : `ppt/slides/${target}`;
          const normalised = resolved.replace(/[^/]+\/\.\.\//g, "");
          if (zip.file(normalised)) return normalised;
        }
      }
    } catch {
      // fall through to the numeric match
    }
  }
  const fallback = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
  return zip.file(fallback) ? fallback : null;
}

/**
 * Extract narration text for every slide, in slide-file order (slide1, slide2,
 * ...), which is the order pptx-preview renders them in. Speaker notes win over
 * the slide body when present. Never throws: on any failure the affected slide
 * simply has no narration.
 */
export async function extractPptxNarration(buffer: ArrayBuffer): Promise<SlideNarration[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideNumbers = Object.keys(zip.files)
      .map((name) => SLIDE_FILE.exec(name))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]))
      .sort((a, b) => a - b);

    const result: SlideNarration[] = [];
    for (const slideNumber of slideNumbers) {
      let entry: SlideNarration = { text: "", fromNotes: false };
      try {
        const notesPath = await findNotesPath(zip, slideNumber);
        if (notesPath) {
          const notesText = extractTextFromXml(await zip.file(notesPath)!.async("string"));
          if (notesText) entry = { text: notesText, fromNotes: true };
        }
        if (!entry.text) {
          const slideXml = await zip.file(`ppt/slides/slide${slideNumber}.xml`)?.async("string");
          entry = { text: slideXml ? extractTextFromXml(slideXml) : "", fromNotes: false };
        }
      } catch {
        entry = { text: "", fromNotes: false };
      }
      result.push(entry);
    }
    return result;
  } catch {
    return [];
  }
}

/** Split text into sentence-ish chunks no longer than MAX_CHUNK_CHARS. */
export function splitIntoChunks(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*["')\]]?\s*/g) ?? [text];
  const chunks: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length <= maxChars) {
      chunks.push(sentence);
      continue;
    }
    let current = "";
    for (const word of sentence.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

const VOICE_LANG_PREFERENCE = ["en-in", "en-gb", "en-us", "en"];

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const preferred of VOICE_LANG_PREFERENCE) {
    const match = voices.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(preferred));
    if (match) return match;
  }
  return voices.find((voice) => voice.default) ?? null;
}

/** Wait briefly for voices to be populated (Chrome fills them asynchronously). */
function waitForVoices(timeoutMs = 600): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const initial = synth.getVoices();
  if (initial.length > 0) return Promise.resolve(initial);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener("voiceschanged", finish);
  });
}

export interface SpeakCallbacks {
  /** All chunks finished (not called after cancel()). */
  onEnd: () => void;
  /** The browser refused to speak (not called for cancellation). */
  onError?: (reason: string) => void;
}

/**
 * Queues sentence-sized utterances for one piece of text. A run id makes
 * callbacks from a cancelled or superseded run inert, so a stale `onend` can
 * never advance the slide.
 */
export class SlideNarrator {
  private runId = 0;
  /** Held so Chrome does not garbage-collect the active utterance mid-speech. */
  private current: SpeechSynthesisUtterance | null = null;

  cancel(): void {
    this.runId += 1;
    this.current = null;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore: nothing to stop
    }
  }

  speak(text: string, callbacks: SpeakCallbacks): void {
    this.cancel();
    const id = this.runId;
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) {
      callbacks.onEnd();
      return;
    }

    void waitForVoices().then((voices) => {
      if (id !== this.runId) return;
      const voice = pickVoice(voices);
      const synth = window.speechSynthesis;
      let position = 0;

      const speakNext = () => {
        if (id !== this.runId) return;
        if (position >= chunks.length) {
          this.current = null;
          callbacks.onEnd();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[position]);
        position += 1;
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        utterance.rate = 1;
        utterance.onend = () => {
          if (id === this.runId) speakNext();
        };
        utterance.onerror = (event) => {
          if (id !== this.runId) return;
          if (event.error === "canceled" || event.error === "interrupted") return;
          this.current = null;
          callbacks.onError?.(event.error);
        };
        this.current = utterance;
        synth.speak(utterance);
      };

      // A short gap after cancel() avoids Chrome dropping the next utterance.
      setTimeout(speakNext, 50);
    });
  }
}
