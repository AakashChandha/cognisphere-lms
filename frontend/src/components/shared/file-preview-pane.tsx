"use client";

import * as React from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileWarning, Loader2, Pause, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  extractPptxNarration,
  isSpeechSupported,
  SlideNarrator,
  type SlideNarration,
} from "@/components/shared/pptx-narration";
import { fetchPreviewBytes, getFileStreamUrl, studentFilesApi } from "@/lib/api/course-files.api";
import { getFilePreviewKind } from "@/lib/utils/file-preview";
import type { PreviewFile } from "@/types/course-file";
import type { FileViewedResult } from "@/types/lesson";
import { ApiError } from "@/types/api";

/**
 * Files already reported in this browser session. Keeps the call idempotent on
 * the client as well as the server, so re-opening a file costs nothing.
 */
const reportedFileIds = new Set<string>();

/** A video counts as watched at this share of its duration. */
const VIDEO_COMPLETE_RATIO = 0.95;
/**
 * The native PDF viewer runs in a cross-origin iframe, so the page the student
 * is on cannot be read. Instead they confirm by hand, and the confirmation
 * only wakes up once the document has been open for this long.
 */
const PDF_MIN_OPEN_MS = 20_000;

/**
 * Reports "the student reached the end of this file" exactly once, never
 * blocking or interrupting the UI: a failure is swallowed and simply leaves the
 * file open to being reported again later.
 */
function useViewReporter(
  file: PreviewFile,
  enabled: boolean,
  onViewed: ((result: FileViewedResult) => void) | undefined,
) {
  const alreadyKnown = file.isViewed === true || reportedFileIds.has(file.id);
  const [reported, setReported] = React.useState(enabled && alreadyKnown);
  const onViewedRef = React.useRef(onViewed);

  React.useEffect(() => {
    onViewedRef.current = onViewed;
  }, [onViewed]);

  const report = React.useCallback(() => {
    if (!enabled || reportedFileIds.has(file.id)) return;
    reportedFileIds.add(file.id);
    setReported(true);
    void studentFilesApi
      .markViewed(file.id)
      .then((result) => onViewedRef.current?.(result))
      .catch(() => {
        // Offline or a transient 5xx: forget it so a later attempt can retry.
        reportedFileIds.delete(file.id);
        setReported(false);
      });
  }, [enabled, file.id]);

  return { reported, report };
}

interface FilePreviewPaneProps {
  file: PreviewFile;
  /** Fired when a video plays to the end (used to auto-complete a lesson). */
  onVideoEnded?: () => void;
  /**
   * Student mode: record progress through the file with
   * `POST /student/files/:id/viewed` when its end is reached.
   */
  trackViewing?: boolean;
  /** Called once the server has accepted the view. */
  onViewed?: (result: FileViewedResult) => void;
}

export function FilePreviewPane({ file, onVideoEnded, trackViewing = false, onViewed }: FilePreviewPaneProps) {
  const previewKind = getFilePreviewKind(file.mimeType, file.originalName);
  // PDF and video get a signed same-origin URL the browser streams directly
  // (Range requests, no full download). PPTX is rendered client-side from
  // bytes, so it is still fetched as a blob.
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = React.useState<ArrayBuffer | null>(null);
  const [isLoading, setIsLoading] = React.useState(previewKind !== null);
  const [error, setError] = React.useState<string | null>(null);
  const { reported, report } = useViewReporter(file, trackViewing, onViewed);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!previewKind) return;

      setIsLoading(true);
      setError(null);
      setStreamUrl(null);
      setArrayBuffer(null);

      try {
        if (previewKind === "pptx") {
          const bytes = await fetchPreviewBytes(file);
          if (cancelled) return;
          setArrayBuffer(bytes);
        } else {
          const { url } = await getFileStreamUrl(file);
          if (cancelled) return;
          setStreamUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load this file");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [file, previewKind]);

  if (!previewKind) {
    return (
      <PreviewMessage message="This file type cannot be viewed in the browser. PDF, PPTX and MP4 video are supported." />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-96 flex-col gap-3 p-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="min-h-80 flex-1 w-full" />
      </div>
    );
  }

  if (error) return <PreviewMessage message={error} />;

  if (previewKind === "pdf" && streamUrl) {
    return (
      <PdfPreviewPane
        src={streamUrl}
        title={file.originalName}
        showConfirmation={trackViewing}
        confirmed={reported}
        onConfirm={report}
      />
    );
  }

  if (previewKind === "video" && streamUrl) {
    return (
      <VideoPreviewPane
        src={streamUrl}
        title={file.originalName}
        onEnded={() => {
          report();
          onVideoEnded?.();
        }}
        onMostlyWatched={report}
      />
    );
  }

  if (previewKind === "pptx" && arrayBuffer) {
    return <PptxPreviewPane buffer={arrayBuffer} onReachedLastSlide={report} />;
  }

  return <PreviewMessage message="The file could not be prepared for preview." />;
}

/**
 * The PDF is shown by the browser's own viewer inside an iframe with
 * `#toolbar=0`, which hides download and print. That iframe is cross-origin,
 * so the page number cannot be read and "reached the last page" cannot be
 * detected. Rather than pretend, the student confirms, and the confirmation
 * only becomes available once the document has been open for a sensible while.
 */
function PdfPreviewPane({
  src,
  title,
  showConfirmation,
  confirmed,
  onConfirm,
}: {
  src: string;
  title: string;
  showConfirmation: boolean;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    showConfirmation ? Math.ceil(PDF_MIN_OPEN_MS / 1000) : 0,
  );

  React.useEffect(() => {
    if (!showConfirmation || confirmed) return;
    const opened = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.ceil((PDF_MIN_OPEN_MS - (Date.now() - opened)) / 1000);
      setSecondsLeft(remaining > 0 ? remaining : 0);
      if (remaining <= 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [showConfirmation, confirmed]);

  const frame = (
    <iframe
      title={title}
      src={`${src}#toolbar=0`}
      className="h-full min-h-[60vh] w-full border-0 sm:min-h-[70vh]"
    />
  );

  if (!showConfirmation) return frame;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{frame}</div>
      <div className="flex flex-col gap-2 border-t border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground sm:text-sm">
          {confirmed
            ? "Marked as read. It counts towards completing this lesson."
            : secondsLeft > 0
              ? `Read to the end, then confirm below (available in ${secondsLeft}s).`
              : "Scrolled to the end? Confirm so this document counts as complete."}
        </p>
        {confirmed ? (
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> Finished
          </span>
        ) : (
          <Button size="sm" onClick={onConfirm} disabled={secondsLeft > 0} className="shrink-0">
            <CheckCircle2 className="size-4" />
            I&apos;ve finished reading this
          </Button>
        )}
      </div>
    </div>
  );
}

function VideoPreviewPane({
  src,
  title,
  onEnded,
  onMostlyWatched,
}: {
  src: string;
  title: string;
  onEnded?: () => void;
  onMostlyWatched?: () => void;
}) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <PreviewMessage message="This video could not be played. It may use a codec the browser does not support; ask your tutor to re-upload it as MP4 (H.264/AAC)." />
    );
  }

  return (
    <div className="flex h-full max-h-[75dvh] min-h-[40vh] items-center justify-center bg-black sm:min-h-[60vh]">
      {/* preload="metadata" fetches only the header, so the first frame and
          duration appear without downloading the whole file. */}
      <video
        src={src}
        title={title}
        controls
        controlsList="nodownload"
        preload="metadata"
        playsInline
        onError={() => setFailed(true)}
        onEnded={onEnded}
        // Counts as watched at 95%: nobody sits through the end credits, and
        // `ended` never fires if the student closes the tab a second early.
        onTimeUpdate={
          onMostlyWatched
            ? (event) => {
                const video = event.currentTarget;
                if (video.duration > 0 && video.currentTime / video.duration >= VIDEO_COMPLETE_RATIO) {
                  onMostlyWatched();
                }
              }
            : undefined
        }
        className="max-h-[75dvh] max-w-full object-contain"
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function PreviewMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-96 flex-col items-center justify-center gap-3 p-6 text-center">
      <FileWarning className="size-10 text-amber-500" />
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type PptxPreviewer = ReturnType<(typeof import("pptx-preview"))["init"]>;

const PPTX_MIN_HEIGHT = 240;
const PPTX_MIN_WIDTH = 320;
/** Give up on a hung render after this long and show an error instead of a spinner. */
const PPTX_RENDER_TIMEOUT_MS = 20_000;
const PPTX_NO_SLIDES_MESSAGE = "This PowerPoint file has no slides the viewer can read.";

/** 16:9 until the deck's real slide ratio has been measured. */
const DEFAULT_SLIDE_RATIO = 9 / 16;

/**
 * Work out the pixel box the slide should be rendered into.
 *
 * The height is derived from the measured width and the deck's slide ratio,
 * so it never depends on an ancestor having a definite height (the lesson
 * page wraps the pane in a plain content-sized div). When the frame does have
 * its own definite height (the viewer dialog) the box is capped to it, and the
 * width is reduced so the whole slide still fits.
 */
function computePptxSize(width: number, availableHeight: number, viewportHeight: number, ratio: number) {
  let maxHeight = Math.max(PPTX_MIN_HEIGHT, Math.floor(viewportHeight * 0.75));
  if (availableHeight > 40) maxHeight = Math.max(PPTX_MIN_HEIGHT, Math.min(maxHeight, Math.floor(availableHeight)));
  const naturalHeight = Math.max(PPTX_MIN_HEIGHT, Math.floor(width * ratio));
  const height = Math.min(maxHeight, naturalHeight);
  const fittedWidth = naturalHeight > height ? Math.floor(height / ratio) : Math.floor(width);
  return { width: Math.max(PPTX_MIN_WIDTH, fittedWidth), height };
}

const AUTO_ADVANCE_STORAGE_KEY = "cgs-lms-pptx-autoadvance";
/** Gap between the last sentence of a slide and moving to the next one. */
const AUTO_ADVANCE_DELAY_MS = 800;
/** How long a slide with nothing to read stays up before auto-advancing. */
const SILENT_SLIDE_DELAY_MS = 4000;

type NarrationPhase =
  | { kind: "idle" }
  | { kind: "reading"; index: number }
  | { kind: "slide-done"; index: number }
  | { kind: "no-text" }
  | { kind: "paused" }
  | { kind: "finished" }
  | { kind: "error" };

function readStoredAutoAdvance(): boolean {
  try {
    const stored = window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

function writeStoredAutoAdvance(value: boolean) {
  try {
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // storage unavailable (private mode, quota): the toggle still works for this session
  }
}

function PptxPreviewPane({
  buffer,
  onReachedLastSlide,
}: {
  buffer: ArrayBuffer;
  /** Fired once the deck's final slide is on screen (however it was reached). */
  onReachedLastSlide?: () => void;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const previewerRef = React.useRef<PptxPreviewer | null>(null);
  const slideIndexRef = React.useRef(0);
  const [error, setError] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState(true);
  const [slideIndex, setSlideIndex] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);

  // --- Narration (Web Speech API). Mutable playback state lives in refs so the
  // speech callbacks and keyboard handlers never see a stale closure; React
  // state only mirrors what the controls bar needs to display.
  // This component is only ever mounted on the client (after the bytes are
  // fetched), so the lazy initialisers may touch window safely.
  const [speechSupported] = React.useState(isSpeechSupported);
  const [autoAdvance, setAutoAdvance] = React.useState(readStoredAutoAdvance);
  const [narration, setNarration] = React.useState<NarrationPhase>({ kind: "idle" });
  const [narrationTexts, setNarrationTexts] = React.useState<SlideNarration[] | null>(null);
  const narratorRef = React.useRef<SlideNarrator | null>(null);
  const narratingRef = React.useRef(false);
  const autoAdvanceRef = React.useRef(autoAdvance);
  const textsRef = React.useRef<SlideNarration[] | null>(null);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest narrate function, so the auto-advance timer can re-enter it. */
  const narrateRef = React.useRef<() => void>(() => {});

  const getNarrator = React.useCallback(() => {
    if (!narratorRef.current) narratorRef.current = new SlideNarrator();
    return narratorRef.current;
  }, []);

  const clearAdvanceTimer = React.useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  }, []);

  /** Stop speech and any pending auto-advance; leaves narratingRef untouched. */
  const silence = React.useCallback(() => {
    clearAdvanceTimer();
    narratorRef.current?.cancel();
  }, [clearAdvanceTimer]);

  const stopNarration = React.useCallback(
    (phase: NarrationPhase) => {
      narratingRef.current = false;
      silence();
      setNarration(phase);
    },
    [silence],
  );

  /**
   * Read whatever slide the previewer is currently showing. Called after every
   * slide change and when the user presses Narrate; a no-op (beyond clearing
   * timers) when narration is not active.
   */
  const narrateCurrentSlide = React.useCallback(() => {
    silence();
    if (!narratingRef.current) return;
    const previewer = previewerRef.current;
    if (!previewer) return;

    const index = previewer.currentIndex;
    const count = previewer.slideCount;
    const isLast = index >= count - 1;
    const text = textsRef.current?.[index]?.text ?? "";

    const advance = () => {
      advanceTimerRef.current = null;
      if (!narratingRef.current) return;
      const current = previewerRef.current;
      if (!current || current.currentIndex >= current.slideCount - 1) {
        stopNarration({ kind: "finished" });
        return;
      }
      current.renderNextSlide();
      slideIndexRef.current = current.currentIndex;
      setSlideIndex(current.currentIndex);
      narrateRef.current();
    };

    if (!text) {
      if (autoAdvanceRef.current && !isLast) {
        setNarration({ kind: "no-text" });
        advanceTimerRef.current = setTimeout(advance, SILENT_SLIDE_DELAY_MS);
      } else if (autoAdvanceRef.current && isLast) {
        stopNarration({ kind: "finished" });
      } else {
        setNarration({ kind: "no-text" });
      }
      return;
    }

    setNarration({ kind: "reading", index });
    getNarrator().speak(text, {
      onEnd: () => {
        if (!narratingRef.current) return;
        if (!autoAdvanceRef.current) {
          setNarration({ kind: "slide-done", index });
          return;
        }
        if (isLast) {
          stopNarration({ kind: "finished" });
          return;
        }
        advanceTimerRef.current = setTimeout(advance, AUTO_ADVANCE_DELAY_MS);
      },
      onError: () => stopNarration({ kind: "error" }),
    });
  }, [getNarrator, silence, stopNarration]);

  React.useEffect(() => {
    narrateRef.current = narrateCurrentSlide;
  }, [narrateCurrentSlide]);

  const toggleNarration = React.useCallback(() => {
    if (!speechSupported) return;
    if (narratingRef.current) {
      stopNarration({ kind: "paused" });
      return;
    }
    narratingRef.current = true;
    narrateCurrentSlide();
  }, [narrateCurrentSlide, speechSupported, stopNarration]);

  const handleAutoAdvanceChange = (checked: boolean) => {
    autoAdvanceRef.current = checked;
    setAutoAdvance(checked);
    writeStoredAutoAdvance(checked);
    // Turning it off must cancel a pending jump; turning it on mid-slide simply
    // applies when the current slide finishes.
    if (!checked) clearAdvanceTimer();
  };

  // Extract per-slide text whenever a new deck arrives; a deck change also
  // stops any narration from the previous one.
  React.useEffect(() => {
    let cancelled = false;
    textsRef.current = null;
    narratingRef.current = false;
    clearAdvanceTimer();
    narratorRef.current?.cancel();

    void extractPptxNarration(buffer).then((texts) => {
      if (cancelled) return;
      textsRef.current = texts;
      setNarrationTexts(texts);
      setNarration({ kind: "idle" });
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __pptxNarration?: SlideNarration[] }).__pptxNarration = texts;
      }
    });

    return () => {
      cancelled = true;
      narratingRef.current = false;
      clearAdvanceTimer();
      narratorRef.current?.cancel();
    };
  }, [buffer, clearAdvanceTimer]);

  React.useEffect(() => {
    const frameElement = frameRef.current;
    const hostElement = hostRef.current;
    if (!frameElement || !hostElement) return;
    const frame: HTMLDivElement = frameElement;
    const host: HTMLDivElement = hostElement;

    let disposed = false;
    let renderToken = 0;
    let lastSize = "";
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    // Learned from the first render; null until then.
    let slideRatio: number | null = null;
    let lastMeasure = { width: 0, availableHeight: 0 };

    function clearWatchdog() {
      if (watchdog) clearTimeout(watchdog);
      watchdog = null;
    }

    async function mount(width: number, height: number) {
      const sizeKey = `${width}x${height}`;
      if (sizeKey === lastSize && previewerRef.current) return;
      lastSize = sizeKey;

      const token = ++renderToken;
      const resumeAt = slideIndexRef.current;
      setIsRendering(true);
      setError(null);
      host.innerHTML = "";
      previewerRef.current?.destroy();
      previewerRef.current = null;

      clearWatchdog();
      watchdog = setTimeout(() => {
        if (disposed || token !== renderToken) return;
        renderToken++; // invalidate the hung render so a late result is ignored
        host.innerHTML = "";
        setError("Unable to render this PowerPoint file in the browser. (Rendering timed out.)");
        setIsRendering(false);
      }, PPTX_RENDER_TIMEOUT_MS);

      try {
        const { init } = await import("pptx-preview");
        if (disposed || token !== renderToken) return;

        const previewer = init(host, { width, height, mode: "slide" });
        await previewer.preview(buffer);
        if (disposed || token !== renderToken) {
          previewer.destroy();
          return;
        }

        // Hide the library's built-in chrome; we render our own Prev/Next bar.
        host
          .querySelectorAll(".pptx-preview-wrapper-next, .pptx-preview-wrapper-pagination")
          .forEach((el) => el.remove());

        const count = previewer.slideCount ?? 0;
        if (count === 0) {
          previewer.destroy();
          host.innerHTML = "";
          setError(PPTX_NO_SLIDES_MESSAGE);
          return;
        }

        // The library scales the slide to the box width and keeps the deck's
        // own aspect ratio (4:3 decks are taller than 16:9). Learn that ratio
        // once, and if the box we guessed does not fit it, re-render in a box
        // that does. This runs at most once per file.
        if (slideRatio === null) {
          const slide = host.querySelector<HTMLElement>(".pptx-preview-slide-wrapper");
          const slideWidth = slide?.offsetWidth ?? 0;
          const slideHeight = slide?.offsetHeight ?? 0;
          slideRatio = slideWidth > 0 && slideHeight > 0 ? slideHeight / slideWidth : DEFAULT_SLIDE_RATIO;
          const fitted = computePptxSize(
            lastMeasure.width,
            lastMeasure.availableHeight,
            window.innerHeight,
            slideRatio,
          );
          if (Math.abs(fitted.width - width) > 2 || Math.abs(fitted.height - height) > 2) {
            previewer.destroy();
            host.innerHTML = "";
            host.style.height = `${fitted.height}px`;
            void mount(fitted.width, fitted.height);
            return;
          }
        }

        const safeIndex = Math.min(Math.max(resumeAt, 0), count - 1);
        if (safeIndex > 0) {
          previewer.renderSingleSlide(safeIndex);
        }

        previewerRef.current = previewer;
        slideIndexRef.current = previewer.currentIndex;
        setSlideCount(count);
        setSlideIndex(previewer.currentIndex);
      } catch (err) {
        if (!disposed && token === renderToken) {
          const detail = err instanceof Error ? err.message : String(err);
          setError(`Unable to render this PowerPoint file in the browser. (${detail})`);
        }
      } finally {
        if (!disposed && token === renderToken) {
          clearWatchdog();
          setIsRendering(false);
        }
      }
    }

    const measureAndMount = () => {
      const width = frame.clientWidth;
      if (width < 40) return;

      // Collapse the host for one synchronous layout so the frame reports the
      // height its *ancestors* give it, not the height the host itself adds.
      // A content-sized frame (lesson page) collapses to ~0; a frame inside a
      // fixed-height flex column (viewer dialog) keeps its real height.
      const previousHeight = host.style.height;
      host.style.height = "0px";
      const availableHeight = frame.clientHeight;
      host.style.height = previousHeight;

      lastMeasure = { width, availableHeight };
      const size = computePptxSize(width, availableHeight, window.innerHeight, slideRatio ?? DEFAULT_SLIDE_RATIO);
      host.style.height = `${size.height}px`;
      void mount(size.width, size.height);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let firstObservation = true;
    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      // ResizeObserver delivers an initial observation on observe(); mount
      // straight away on that one, debounce the rest.
      if (firstObservation) {
        firstObservation = false;
        measureAndMount();
        return;
      }
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!disposed) measureAndMount();
      }, 180);
    });
    resizeObserver.observe(frame);

    return () => {
      disposed = true;
      clearWatchdog();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      previewerRef.current?.destroy();
      previewerRef.current = null;
      host.innerHTML = "";
      host.style.height = "";
    };
  }, [buffer]);

  // Any manual slide change cancels a pending auto-advance and, while
  // narrating, reads the newly shown slide from its start.
  const goToPrevious = React.useCallback(() => {
    const previewer = previewerRef.current;
    if (!previewer || previewer.slideCount <= 1) return;
    previewer.renderPreSlide();
    slideIndexRef.current = previewer.currentIndex;
    setSlideIndex(previewer.currentIndex);
    narrateCurrentSlide();
  }, [narrateCurrentSlide]);

  const goToNext = React.useCallback(() => {
    const previewer = previewerRef.current;
    if (!previewer || previewer.slideCount <= 1) return;
    previewer.renderNextSlide();
    slideIndexRef.current = previewer.currentIndex;
    setSlideIndex(previewer.currentIndex);
    narrateCurrentSlide();
  }, [narrateCurrentSlide]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (event.key === " " || event.key === "Spacebar") {
        // A focused button/switch already activates on Space; do not double up.
        if (target && (target.tagName === "BUTTON" || target.closest('[role="switch"], button'))) return;
        if (!previewerRef.current) return;
        event.preventDefault();
        toggleNarration();
        return;
      }

      const previewer = previewerRef.current;
      if (!previewer || previewer.slideCount <= 1) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToNext, goToPrevious, toggleNarration]);

  // Reaching the final slide — by Next, by the keyboard, or by narration
  // auto-advance — means the student has been through the whole deck. Every
  // route sets `slideIndex`, so watching it covers all of them (including a
  // one-slide deck, which is complete as soon as it renders).
  const lastSlideReached = slideCount > 0 && slideIndex >= slideCount - 1;
  React.useEffect(() => {
    if (lastSlideReached) onReachedLastSlide?.();
  }, [lastSlideReached, onReachedLastSlide]);

  // Speech must never outlive the viewer (dialog close, route change).
  React.useEffect(() => {
    return () => {
      narratingRef.current = false;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
      narratorRef.current?.cancel();
    };
  }, []);

  const isNarrating =
    narration.kind === "reading" || narration.kind === "slide-done" || narration.kind === "no-text";
  const currentEntry = narrationTexts?.[slideIndex];
  const narrationStatus = (() => {
    switch (narration.kind) {
      case "reading":
        return `Reading slide ${narration.index + 1} of ${slideCount}`;
      case "slide-done":
        return `Finished slide ${narration.index + 1} of ${slideCount}`;
      case "no-text":
        return "No text on this slide";
      case "paused":
        return "Paused";
      case "finished":
        return "Finished";
      case "error":
        return "Narration could not start in this browser";
      default:
        return narrationTexts === null ? "Preparing narration…" : "Press Narrate to hear this slide";
    }
  })();

  if (error) return <PreviewMessage message={error} />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background px-3 py-2">
        {speechSupported ? (
          <>
            <Button
              type="button"
              variant={isNarrating ? "secondary" : "default"}
              size="sm"
              onClick={toggleNarration}
              disabled={isRendering || slideCount === 0 || narrationTexts === null}
              aria-pressed={isNarrating}
              aria-label={isNarrating ? "Pause narration" : "Narrate this slide"}
            >
              {isNarrating ? <Pause className="size-4" /> : <Play className="size-4" />}
              {isNarrating ? "Pause" : "Narrate"}
            </Button>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={autoAdvance} onCheckedChange={handleAutoAdvanceChange} aria-label="Auto-advance" />
              Auto-advance
            </label>

            <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span className="truncate">{narrationStatus}</span>
              {currentEntry?.fromNotes ? <Badge variant="secondary">Tutor notes</Badge> : null}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Narration is not supported in this browser</p>
        )}
      </div>

      {/* The frame only supplies width (and height when an ancestor fixes it);
          the host gets an explicit pixel height from the effect, so the pane
          renders even inside a content-sized wrapper. */}
      <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden bg-muted/30">
        {isRendering ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <div ref={hostRef} className="w-full" style={{ height: PPTX_MIN_HEIGHT }} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goToPrevious}
          disabled={isRendering || slideCount <= 1}
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        <p className="text-sm tabular-nums text-muted-foreground">
          {slideCount > 0 ? `Slide ${slideIndex + 1} of ${slideCount}` : "Preparing slides…"}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goToNext}
          disabled={isRendering || slideCount <= 1}
          aria-label="Next slide"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
