import Image from "next/image";
import { Logo, LogoLockupImage } from "@/components/brand/logo";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Headline shown over the cover photograph on large screens. */
  coverHeadline?: string;
  /** Supporting line under the cover headline. */
  coverBody?: string;
}

/**
 * Split auth screen: the training-room photograph fills one side on large
 * screens, the form sits on the other. Below `lg` the photograph drops out
 * entirely rather than shrinking to a band, so the form is never pushed off
 * a 375px-wide screen.
 */
export function AuthLayout({
  title,
  description,
  children,
  coverHeadline = "NEBOSH-accredited health and safety training.",
  coverBody = "Courses, lesson materials, assessments and certificates for every learner — in one place.",
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/brand/login-cover.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="(min-width: 1280px) 55vw, 52vw"
          className="object-cover object-center"
        />
        <div aria-hidden className="cover-scrim absolute inset-0" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <LogoLockupImage width={224} priority />

          <div className="max-w-lg">
            <h2 className="font-heading text-4xl font-semibold text-white">
              {coverHeadline}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
              {coverBody}
            </p>
            <p className="mt-10 text-xs font-medium tracking-wide text-white/60 uppercase">
              Cognisphere Management and Consultancy
            </p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo size="lg" tagline className="mb-8 lg:hidden" priority />

          <div className="rounded-2xl bg-card p-6 text-card-foreground shadow-lg ring-1 ring-foreground/10 sm:p-8">
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

          <p className="mt-8 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Cognisphere Management and Consultancy
          </p>
        </div>
      </main>
    </div>
  );
}
