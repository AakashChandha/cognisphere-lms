"use client";

import { RequireRole } from "@/components/auth/require-role";
import { AppRole } from "@/types/auth";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role={AppRole.MASTER} profileHref="/master/profile">
      {children}
    </RequireRole>
  );
}
