"use client";

import { RequireRole } from "@/components/auth/require-role";
import { AppRole } from "@/types/auth";

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role={AppRole.TUTOR} profileHref="/tutor/profile">
      {children}
    </RequireRole>
  );
}
