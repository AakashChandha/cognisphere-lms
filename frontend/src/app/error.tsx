"use client";

import * as React from "react";
import { ServerCrash, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <ServerCrash className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">500</p>
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page. Please try again.
        </p>
      </div>
      <Button onClick={() => reset()}>
        <RotateCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
