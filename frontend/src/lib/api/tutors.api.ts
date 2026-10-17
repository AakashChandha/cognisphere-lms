import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { TutorDashboard } from "@/types/dashboard";
import type { Student, Tutor } from "@/types/people";
import type { StudentProgressDetail } from "@/types/student-progress";

export const tutorsApi = {
  getDashboard() {
    return unwrap(apiClient.get<ApiEnvelope<TutorDashboard>>("/tutor/dashboard"));
  },
  listStudents(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Student[]>>("/tutor/students", { params: cleanParams(params) }),
    );
  },
  /** One student's progress across this tutor's own courses. 404 if they are in none of them. */
  getStudent(studentId: string) {
    return unwrap(
      apiClient.get<ApiEnvelope<StudentProgressDetail>>(`/tutor/students/${studentId}`),
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
