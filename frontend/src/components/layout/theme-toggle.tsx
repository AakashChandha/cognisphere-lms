"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Deferring to an effect (rather than deriving during render) avoids a
    // server/client hydration mismatch, since the resolved theme is only
    // known once we're running in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled className="opacity-0" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Both icons stay mounted and cross-fade, so a fast double-tap
          reverses from whatever is currently on screen instead of restarting
          an animation from the target state. */}
      <span className="relative block size-4.5">
        <Sun
          aria-hidden
          className="absolute inset-0 size-4.5 transition-[opacity,rotate,scale] duration-(--duration-base) ease-spring data-[on=false]:scale-75 data-[on=false]:-rotate-90 data-[on=false]:opacity-0"
          data-on={isDark}
        />
        <Moon
          aria-hidden
          className="absolute inset-0 size-4.5 transition-[opacity,rotate,scale] duration-(--duration-base) ease-spring data-[on=false]:scale-75 data-[on=false]:rotate-90 data-[on=false]:opacity-0"
          data-on={!isDark}
        />
      </span>
    </Button>
  );
}
