import { apiClient, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope } from "@/types/api";
import type { AuditLog, QueryAuditLogParams } from "@/types/audit-log";

export const auditLogsApi = {
  list(params: QueryAuditLogParams) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<AuditLog[]>>("/master/auditlogs", { params: cleanParams(params) }),
    );
  },
};
