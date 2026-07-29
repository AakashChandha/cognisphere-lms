import { apiClient, unwrap } from "./client";
import type { ApiEnvelope } from "@/types/api";
import type { AppRole } from "@/types/auth";
import type { Profile, UpdateProfilePayload } from "@/types/people";

function profilePath(role: AppRole): string {
  switch (role) {
    case "MASTER":
      return "/master/profile";
    case "TUTOR":
      return "/tutor/profile";
    case "STUDENT":
    default:
      return "/student/profile";
  }
}

export const profileApi = {
  getProfile(role: AppRole) {
    return unwrap(apiClient.get<ApiEnvelope<Profile>>(profilePath(role)));
  },
  updateProfile(role: AppRole, payload: UpdateProfilePayload) {
    return unwrap(apiClient.put<ApiEnvelope<Profile>>(profilePath(role), payload));
  },
};
