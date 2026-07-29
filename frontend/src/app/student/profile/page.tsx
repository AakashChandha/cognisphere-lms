"use client";

import { ProfilePageContent } from "@/components/profile/profile-page-content";
import { AppRole } from "@/types/auth";

export default function StudentProfilePage() {
  return <ProfilePageContent role={AppRole.STUDENT} />;
}
