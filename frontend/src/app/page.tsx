"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { getHomePathForRoles } from "@/lib/constants/roles";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    router.replace(user ? getHomePathForRoles(user.roles) : "/login");
  }, [isLoading, user, router]);

  return <FullPageSpinner />;
}
