import { Loader2 } from "lucide-react";

export function FullPageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
