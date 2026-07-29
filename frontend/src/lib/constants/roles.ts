import { AppRole } from "@/types/auth";

/** Priority order used to pick a single "primary" role for routing/navigation when a user has more than one. */
const ROLE_PRIORITY: AppRole[] = [AppRole.MASTER, AppRole.TUTOR, AppRole.STUDENT];

export const ROLE_HOME_PATH: Record<AppRole, string> = {
  [AppRole.MASTER]: "/master/dashboard",
  [AppRole.TUTOR]: "/tutor/dashboard",
  [AppRole.STUDENT]: "/student/dashboard",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  [AppRole.MASTER]: "Master Administrator",
  [AppRole.TUTOR]: "Tutor",
  [AppRole.STUDENT]: "Student",
};

export function getPrimaryRole(roles: AppRole[]): AppRole | null {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? null;
}

export function getHomePathForRoles(roles: AppRole[]): string {
  const primary = getPrimaryRole(roles);
  return primary ? ROLE_HOME_PATH[primary] : "/login";
}
