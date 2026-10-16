export enum AppRole {
  MASTER = "MASTER",
  TUTOR = "TUTOR",
  STUDENT = "STUDENT",
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  roles: AppRole[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
  /** True until the user replaces an admin-issued temporary password. */
  mustChangePassword: boolean;
}
