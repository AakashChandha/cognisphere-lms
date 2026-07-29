"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, FileWarning, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchFileBlob } from "@/lib/api/course-files.api";
import { getFilePreviewKind } from "@/lib/utils/file-preview";
import type { CourseFile } from "@/types/course-file";
import { ApiError } from "@/types/api";

export function FilePreviewPane({ file }: { file: CourseFile }) {
  const previewKind = getFilePreviewKind(file.mimeType, file.originalName);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = React.useState<ArrayBuffer | null>(null);
  const [isLoading, setIsLoading] = React.useState(previewKind !== null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      if (!previewKind) return;

      setIsLoading(true);
      setError(null);
      setBlobUrl(null);
      setArrayBuffer(null);

      try {
        const blob = await fetchFileBlob(file.downloadUrl);
        if (cancelled) return;

        if (previewKind === "pdf") {
          objectUrl = window.URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        } else {
          setArrayBuffer(await blob.arrayBuffer());
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
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [file.downloadUrl, previewKind]);

  if (!previewKind) {
    return (
      <PreviewMessage message="This file type cannot be viewed in the browser. Only PDF and PPTX files are supported." />
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

  if (previewKind === "pdf" && blobUrl) {
    return <iframe title={file.originalName} src={blobUrl} className="h-full min-h-[70vh] w-full border-0" />;
  }

  if (previewKind === "pptx" && arrayBuffer) {
    return <PptxPreviewPane buffer={arrayBuffer} />;
  }

  return <PreviewMessage message="The file could not be prepared for preview." />;
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

function PptxPreviewPane({ buffer }: { buffer: ArrayBuffer }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const previewerRef = React.useRef<PptxPreviewer | null>(null);
  const slideIndexRef = React.useRef(0);
  const [error, setError] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState(true);
  const [slideIndex, setSlideIndex] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);

  React.useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement) return;
    const host: HTMLDivElement = hostElement;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let renderToken = 0;
    let lastSize = "";

    async function mount(width: number, height: number) {
      const sizeKey = `${Math.floor(width)}x${Math.floor(height)}`;
      if (sizeKey === lastSize && previewerRef.current) return;
      lastSize = sizeKey;

      const token = ++renderToken;
      const resumeAt = slideIndexRef.current;
      setIsRendering(true);
      setError(null);
      host.innerHTML = "";
      previewerRef.current?.destroy();
      previewerRef.current = null;

      try {
        const { init } = await import("pptx-preview");
        if (disposed || token !== renderToken) return;

        const previewer = init(host, {
          width: Math.max(Math.floor(width), 320),
          height: Math.max(Math.floor(height), 240),
          mode: "slide",
        });
        await previewer.preview(buffer);
        if (disposed || token !== renderToken) {
          previewer.destroy();
          return;
        }

        // Hide the library's built-in chrome; we render our own Prev/Next bar.
        host
          .querySelectorAll(".pptx-preview-wrapper-next, .pptx-preview-wrapper-pagination")
          .forEach((el) => el.remove());

        const safeIndex = Math.min(Math.max(resumeAt, 0), Math.max(previewer.slideCount - 1, 0));
        if (safeIndex > 0) {
          previewer.renderSingleSlide(safeIndex);
        }

        previewerRef.current = previewer;
        slideIndexRef.current = previewer.currentIndex;
        setSlideCount(previewer.slideCount);
        setSlideIndex(previewer.currentIndex);
      } catch (err) {
        if (!disposed && token === renderToken) {
          const detail = err instanceof Error ? err.message : String(err);
          setError(`Unable to render this PowerPoint file in the browser. (${detail})`);
        }
      } finally {
        if (!disposed && token === renderToken) setIsRendering(false);
      }
    }

    const scheduleMount = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width < 40 || height < 40) return;
      void mount(width, height);
    };

    scheduleMount();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!disposed) scheduleMount();
      }, 180);
    });
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      previewerRef.current?.destroy();
      previewerRef.current = null;
      host.innerHTML = "";
    };
  }, [buffer]);

  const goToPrevious = () => {
    const previewer = previewerRef.current;
    if (!previewer || previewer.slideCount <= 1) return;
    previewer.renderPreSlide();
    slideIndexRef.current = previewer.currentIndex;
    setSlideIndex(previewer.currentIndex);
  };

  const goToNext = () => {
    const previewer = previewerRef.current;
    if (!previewer || previewer.slideCount <= 1) return;
    previewer.renderNextSlide();
    slideIndexRef.current = previewer.currentIndex;
    setSlideIndex(previewer.currentIndex);
  };

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const previewer = previewerRef.current;
      if (!previewer || previewer.slideCount <= 1) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previewer.renderPreSlide();
        slideIndexRef.current = previewer.currentIndex;
        setSlideIndex(previewer.currentIndex);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        previewer.renderNextSlide();
        slideIndexRef.current = previewer.currentIndex;
        setSlideIndex(previewer.currentIndex);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (error) return <PreviewMessage message={error} />;

  return (
    <div className="flex h-full min-h-[70vh] flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/30">
        {isRendering ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <div ref={hostRef} className="h-full w-full" />
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
