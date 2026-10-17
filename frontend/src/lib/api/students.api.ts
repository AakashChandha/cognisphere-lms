import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { StudentDashboard } from "@/types/dashboard";
import type { Student } from "@/types/people";
import type { StudentProgressDetail } from "@/types/student-progress";

export const studentsApi = {
  getDashboard() {
    return unwrap(apiClient.get<ApiEnvelope<StudentDashboard>>("/student/dashboard"));
  },
  listForMaster(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Student[]>>("/master/students", { params: cleanParams(params) }),
    );
  },
  /** One student's progress across every course. Same shape as the tutor route, unscoped. */
  getForMaster(studentId: string) {
    return unwrap(
      apiClient.get<ApiEnvelope<StudentProgressDetail>>(`/master/students/${studentId}`),
    );
  },
};
