"use client";

import { ProfilePageContent } from "@/components/profile/profile-page-content";
import { AppRole } from "@/types/auth";

export default function TutorProfilePage() {
  return <ProfilePageContent role={AppRole.TUTOR} showExpertise />;
}
