import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand marks for Cognisphere Management and Consultancy.
 *
 * `cognisphere-mark.png` is the swirl cropped out of the supplied lockup with
 * its alpha channel intact, so it sits correctly on light *and* dark surfaces
 * with no plate behind it. The supplied full lockup (`cognisphere-logo.webp`)
 * sets its wordmark in near-black, which disappears on a dark surface — so
 * anywhere the theme can flip, we pair the mark with the wordmark as live
 * text. `LogoLockupImage` renders the untouched official lockup and is only
 * used on surfaces that are light in both themes.
 */

const MARK_SRC = "/brand/cognisphere-mark.png";
const LOCKUP_SRC = "/brand/cognisphere-logo.webp";

type LogoSize = "sm" | "md" | "lg";

const MARK_PX: Record<LogoSize, number> = { sm: 28, md: 34, lg: 44 };
const NAME_CLASS: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

export function LogoMark({
  size = "md",
  className,
  priority = false,
}: {
  size?: LogoSize | number;
  className?: string;
  priority?: boolean;
}) {
  const px = typeof size === "number" ? size : MARK_PX[size];
  return (
    <Image
      src={MARK_SRC}
      alt=""
      aria-hidden
      width={px}
      height={px}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
      style={{ width: px, height: px }}
    />
  );
}

/**
 * Mark + wordmark, with the wordmark as text so it inherits the theme.
 * This is the lockup used in the product chrome.
 */
export function Logo({
  size = "md",
  tagline = false,
  subtitle,
  className,
  priority = false,
}: {
  size?: LogoSize;
  /** Show "Management and Consultancy" under the wordmark. */
  tagline?: boolean;
  /** Alternative second line (a role label in the sidebar, for instance). */
  subtitle?: string;
  className?: string;
  priority?: boolean;
}) {
  const second = subtitle ?? (tagline ? "Management and Consultancy" : null);

  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark size={size} priority={priority} />
      <span className="flex min-w-0 flex-col justify-center">
        <span
          className={cn(
            "truncate font-heading font-semibold text-foreground",
            NAME_CLASS[size],
          )}
          style={{ letterSpacing: "-0.018em" }}
        >
          Cognisphere
        </span>
        {second ? (
          <span className="truncate text-xs text-muted-foreground">{second}</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The untouched supplied lockup. Its wordmark is near-black, so it needs a
 * light surface underneath in both themes — `plate` provides one.
 */
export function LogoLockupImage({
  width = 236,
  plate = true,
  className,
  priority = false,
}: {
  width?: number;
  plate?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const height = Math.round((width * 602) / 1600);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        plate &&
          "rounded-2xl bg-white/92 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur-md",
        className,
      )}
    >
      <Image
        src={LOCKUP_SRC}
        alt="Cognisphere Management and Consultancy"
        width={width}
        height={height}
        priority={priority}
        className="select-none"
        style={{ width, height }}
      />
    </span>
  );
}
