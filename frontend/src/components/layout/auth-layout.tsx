import Image from "next/image";
import { LogoLockupImage } from "@/components/brand/logo";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Headline shown under the form card. */
  coverHeadline?: string;
  /** Supporting line under the cover headline. */
  coverBody?: string;
}

/**
 * Auth screen: the training-room photograph fills the whole viewport behind a
 * brand-tinted scrim, and the logo, form card and page message sit centred on
 * top. The photograph stays at every width; on a 375px screen it is simply
 * cropped further, and the column scrolls if a short screen cannot fit it.
 */
export function AuthLayout({
  title,
  description,
  children,
  coverHeadline = "NEBOSH-accredited health and safety training.",
  coverBody = "Courses, lesson materials, assessments and certificates for every learner — in one place.",
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background">
      <div aria-hidden className="fixed inset-0">
        <Image
          src="/brand/login-cover.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[oklch(0.16_0.04_288/0.62)]" />
      </div>

      <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="flex w-full max-w-sm flex-col items-center">
          <LogoLockupImage width={200} priority className="mb-8" />

          <div className="w-full rounded-2xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-foreground/10 sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {children}
          </div>

          <div className="mt-8 max-w-md text-center">
            <h2 className="font-heading text-lg font-semibold text-white">{coverHeadline}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{coverBody}</p>
          </div>

          <p className="mt-8 text-center text-xs text-white/60">
            &copy; {new Date().getFullYear()} Cognisphere Management and Consultancy
          </p>
        </div>
      </main>
    </div>
  );
}
