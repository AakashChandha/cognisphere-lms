"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Debounced search box: notifies `onChange` 350ms after typing stops. */
export function SearchInput({ value, onChange, placeholder = "Search...", className }: SearchInputProps) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    // Keeps the local draft in sync when the controlled `value` changes
    // externally (e.g. cleared by a parent), without fighting user typing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
      />
      {draft ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={() => {
            setDraft("");
            onChange("");
          }}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
