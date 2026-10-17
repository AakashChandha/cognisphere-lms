"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/lib/auth/auth-context";
import { getHomePathForRoles } from "@/lib/constants/roles";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const homeHref = user ? getHomePathForRoles(user.roles) : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md">
        <Logo size="md" tagline className="mb-8 justify-center" />

        <div className="rounded-2xl bg-card p-8 text-center text-card-foreground shadow-lg ring-1 ring-foreground/10">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Access denied</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-pretty text-muted-foreground">
            You don&apos;t have permission to view this page. If you believe this is a mistake,
            contact your administrator.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button nativeButton={false} render={<Link href={homeHref} />}>
              Go to dashboard
            </Button>
            {user ? (
              <Button variant="ghost" onClick={() => void logout()}>
                Log out
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
