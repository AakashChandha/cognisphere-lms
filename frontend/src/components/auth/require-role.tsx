"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginPathWithReturn, useAuth } from "@/lib/auth/auth-context";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { AppShell } from "@/components/layout/app-shell";
import type { AppRole } from "@/types/auth";

interface RequireRoleProps {
  role: AppRole;
  profileHref: string;
  children: React.ReactNode;
}

/** Gates a role-specific route group: redirects to `/login` when unauthenticated, `/unauthorized` on a role mismatch. */
export function RequireRole({ role, profileHref, children }: RequireRoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  const isAuthorized = !!user?.roles.includes(role);
  const mustChangePassword = !!user?.mustChangePassword;

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(loginPathWithReturn(pathname));
      return;
    }
    if (mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    if (!isAuthorized) {
      router.replace("/unauthorized");
    }
  }, [isLoading, user, isAuthorized, mustChangePassword, router, pathname]);

  if (isLoading || !user || !isAuthorized || mustChangePassword) {
    return <FullPageSpinner />;
  }

  return (
    <AppShell role={role} profileHref={profileHref}>
      {children}
    </AppShell>
  );
}
