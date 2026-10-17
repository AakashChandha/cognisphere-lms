import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope } from "@/types/api";
import type {
  CreateQueryMessagePayload,
  CreateQueryPayload,
  QueryDetail,
  QueryListParams,
  QueryStaffRole,
  QuerySummary,
} from "@/types/query";

/**
 * The student's own threads: they are the only role that can raise a query and
 * the only one that can close it.
 */
export const studentQueriesApi = {
  list(params: QueryListParams = {}) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<QuerySummary[]>>("/student/queries", { params: cleanParams(params) }),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<QueryDetail>>(`/student/queries/${id}`));
  },
  create(payload: CreateQueryPayload) {
    return unwrap(apiClient.post<ApiEnvelope<QueryDetail>>("/student/queries", payload));
  },
  /** Sets the thread back to OPEN. 409 once it is RESOLVED. */
  reply(id: string, payload: CreateQueryMessagePayload) {
    return unwrap(apiClient.post<ApiEnvelope<QueryDetail>>(`/student/queries/${id}/messages`, payload));
  },
  /** Final: a resolved thread is never reopened. 409 if it already is. */
  resolve(id: string) {
    return unwrap(apiClient.patch<ApiEnvelope<QueryDetail>>(`/student/queries/${id}/resolve`));
  },
};

/**
 * Staff inbox. TUTOR is scoped to the courses they own, MASTER sees every
 * course; the two controllers are identical apart from the prefix, so one
 * factory serves both. Staff reply — there is deliberately no resolve route.
 */
function createStaffQueriesApi(role: QueryStaffRole) {
  const base = `/${role}`;
  return {
    role,
    list(params: QueryListParams = {}) {
      return unwrapPaginated(
        apiClient.get<ApiEnvelope<QuerySummary[]>>(`${base}/queries`, { params: cleanParams(params) }),
      );
    },
    getById(id: string) {
      return unwrap(apiClient.get<ApiEnvelope<QueryDetail>>(`${base}/queries/${id}`));
    },
    /** Sets the thread to ANSWERED. 409 once it is RESOLVED. */
    reply(id: string, payload: CreateQueryMessagePayload) {
      return unwrap(apiClient.post<ApiEnvelope<QueryDetail>>(`${base}/queries/${id}/messages`, payload));
    },
  };
}

export const tutorQueriesApi = createStaffQueriesApi("tutor");
export const masterQueriesApi = createStaffQueriesApi("master");

export type StaffQueriesApi = ReturnType<typeof createStaffQueriesApi>;

/** Picks the controller pair that matches the signed-in staff role. */
export function staffQueriesApiFor(role: QueryStaffRole): StaffQueriesApi {
  return role === "master" ? masterQueriesApi : tutorQueriesApi;
}
