import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { TutorDashboard } from "@/types/dashboard";
import type { Student, Tutor } from "@/types/people";

export const tutorsApi = {
  getDashboard() {
    return unwrap(apiClient.get<ApiEnvelope<TutorDashboard>>("/tutor/dashboard"));
  },
  listStudents(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Student[]>>("/tutor/students", { params: cleanParams(params) }),
    );
  },
  listStudentDirectory(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Student[]>>("/tutor/students/directory", { params: cleanParams(params) }),
    );
  },
  listForMaster(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Tutor[]>>("/master/tutors", { params: cleanParams(params) }),
    );
  },
};
