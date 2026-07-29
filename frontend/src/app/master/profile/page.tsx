"use client";

import { ProfilePageContent } from "@/components/profile/profile-page-content";
import { AppRole } from "@/types/auth";

export default function MasterProfilePage() {
  return <ProfilePageContent role={AppRole.MASTER} />;
}
