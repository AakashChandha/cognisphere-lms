import { apiClient, unwrap } from "./client";
import type { ApiEnvelope } from "@/types/api";
import type {
  AuthResponse,
  AuthTokens,
  AuthenticatedUser,
  ChangePasswordPayload,
  LoginPayload,
} from "@/types/auth";

export const authApi = {
  login(payload: LoginPayload) {
    return unwrap(apiClient.post<ApiEnvelope<AuthResponse>>("/auth/login", payload));
  },
  me() {
    return unwrap(apiClient.get<ApiEnvelope<AuthenticatedUser>>("/auth/me"));
  },
  refresh(refreshToken: string) {
    return unwrap(apiClient.post<ApiEnvelope<AuthTokens>>("/auth/refresh", { refreshToken }));
  },
  logout(refreshToken: string) {
    return unwrap(apiClient.post<ApiEnvelope<null>>("/auth/logout", { refreshToken }));
  },
  changePassword(payload: ChangePasswordPayload) {
    return unwrap(apiClient.post<ApiEnvelope<null>>("/auth/change-password", payload));
  },
};
