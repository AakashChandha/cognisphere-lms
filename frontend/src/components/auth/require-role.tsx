"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
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
  const { user, isLoading } = useAuth();

  const isAuthorized = !!user?.roles.includes(role);

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAuthorized) {
      router.replace("/unauthorized");
    }
  }, [isLoading, user, isAuthorized, router]);

  if (isLoading || !user || !isAuthorized) {
    return <FullPageSpinner />;
  }

  return (
    <AppShell role={role} profileHref={profileHref}>
      {children}
    </AppShell>
  );
}
