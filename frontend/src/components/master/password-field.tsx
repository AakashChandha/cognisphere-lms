"use client";

import * as React from "react";
import { Copy, Check, Eye, EyeOff, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateTemporaryPassword } from "@/lib/utils/format";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
}

/** Temporary-password input with generate, show/hide and copy, so admins never have to invent one. */
export function PasswordField({ value, onChange, onBlur, name, id }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="pr-9 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Generate a password"
        title="Generate a password"
        onClick={() => {
          onChange(generateTemporaryPassword());
          setVisible(true);
        }}
      >
        <Wand2 className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Copy password" title="Copy password" disabled={!value} onClick={() => void copy()}>
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
