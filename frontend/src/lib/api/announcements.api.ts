import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type {
  Announcement,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
} from "@/types/announcement";

export const announcementsApi = {
  list(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Announcement[]>>("/announcements", { params: cleanParams(params) }),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<Announcement>>(`/announcements/${id}`));
  },
  create(payload: CreateAnnouncementPayload) {
    return unwrap(apiClient.post<ApiEnvelope<Announcement>>("/announcements", payload));
  },
  update(id: string, payload: UpdateAnnouncementPayload) {
    return unwrap(apiClient.patch<ApiEnvelope<Announcement>>(`/announcements/${id}`, payload));
  },
  remove(id: string) {
    return unwrap(apiClient.delete<ApiEnvelope<null>>(`/announcements/${id}`));
  },
};
