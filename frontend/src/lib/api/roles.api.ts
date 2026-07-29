import { apiClient, unwrap } from "./client";
import type { ApiEnvelope } from "@/types/api";
import type { Role } from "@/types/people";

export const rolesApi = {
  list() {
    return unwrap(apiClient.get<ApiEnvelope<Role[]>>("/master/roles"));
  },
};
