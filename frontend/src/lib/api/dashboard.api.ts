import { apiClient, unwrap } from "./client";
import type { ApiEnvelope } from "@/types/api";
import type { MasterDashboard } from "@/types/dashboard";

export const masterDashboardApi = {
  get() {
    return unwrap(apiClient.get<ApiEnvelope<MasterDashboard>>("/master/dashboard"));
  },
};
