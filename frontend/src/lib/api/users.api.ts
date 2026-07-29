import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope } from "@/types/api";
import type {
  CreateUserPayload,
  ManagedUser,
  QueryUserParams,
  UpdateUserPayload,
} from "@/types/people";

export const usersApi = {
  list(params: QueryUserParams) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<ManagedUser[]>>("/master/users", { params: cleanParams(params) }),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<ManagedUser>>(`/master/users/${id}`));
  },
  create(payload: CreateUserPayload) {
    return unwrap(apiClient.post<ApiEnvelope<ManagedUser>>("/master/users", payload));
  },
  update(id: string, payload: UpdateUserPayload) {
    return unwrap(apiClient.patch<ApiEnvelope<ManagedUser>>(`/master/users/${id}`, payload));
  },
  setActive(id: string, isActive: boolean) {
    return unwrap(
      apiClient.patch<ApiEnvelope<ManagedUser>>(`/master/users/${id}/status`, { isActive }),
    );
  },
  resetPassword(id: string, newPassword: string) {
    return unwrap(apiClient.post<ApiEnvelope<null>>(`/master/users/${id}/reset-password`, { newPassword }));
  },
  remove(id: string) {
    return unwrap(apiClient.delete<ApiEnvelope<null>>(`/master/users/${id}`));
  },
};
