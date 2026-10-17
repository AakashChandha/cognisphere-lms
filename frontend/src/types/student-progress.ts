/**
 * Staff view of one student's progress — the mirror of what the student sees
 * on their own course page, scoped to the caller's courses.
 *
 * Shapes mirror `StudentProgressDetailDto` exactly:
 * `GET /tutor/students/:studentId` (the tutor's own courses) and
 * `GET /master/students/:studentId` (every course).
 */

export interface StudentProgressCourseAssessment {
  id: string;
  title: string;
  type: "MCQ" | "DOCUMENT";
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "PASSED" | "FAILED";
  passPercent: number;
  bestScorePercent: number | null;
  attemptsCount: number;
  latestAttemptId: string | null;
}

export interface StudentProgressCourseLesson {
  id: string;
  title: string;
  orderIndex: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface StudentProgressCourse {
  courseId: string;
  courseTitle: string;
  thumbnailUrl: string | null;
  progressionMode: "FREE" | "SEQUENTIAL";
  enrolledAt: string;
  completedLessons: number;
  totalLessons: number;
  /** 0..100, rounded; 0 when `totalLessons === 0`. */
  percent: number;
  /** First incomplete lesson in order. */
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  /** Newest of lesson completions and attempt updates. */
  lastActivityAt: string | null;
  lessons: StudentProgressCourseLesson[];
  assessments: StudentProgressCourseAssessment[];
}

export interface StudentProgressStudent {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface StudentProgressTotals {
  coursesCount: number;
  /** Courses where `completedLessons === totalLessons && totalLessons > 0`. */
  completedCoursesCount: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  /** `round(100 * lessonsCompleted / lessonsTotal)`, 0 when `lessonsTotal === 0`. */
  overallPercent: number;
  assessmentsPassed: number;
  assessmentsTotal: number;
}

export interface StudentProgressDetail {
  student: StudentProgressStudent;
  totals: StudentProgressTotals;
  /** Ordered by `enrolledAt` desc. */
  courses: StudentProgressCourse[];
}
