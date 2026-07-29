"use client";

import { RequireRole } from "@/components/auth/require-role";
import { AppRole } from "@/types/auth";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role={AppRole.STUDENT} profileHref="/student/profile">
      {children}
    </RequireRole>
  );
}
