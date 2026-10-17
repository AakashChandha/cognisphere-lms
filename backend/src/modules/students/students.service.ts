import { Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, AttemptStatus, CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StudentResponseDto } from './dto/student-response.dto';
import { StudentDashboardDto } from './dto/student-dashboard.dto';
import { computeAssessmentStanding } from '../assessments/assessment-standing.util';
import {
  StudentProgressCourseAssessmentDto,
  StudentProgressDetailDto,
} from './dto/student-progress.dto';

/** One attempt, reduced to what a standing is computed from. */
type AttemptStanding = {
  id: string;
  assessmentId: string;
  status: AttemptStatus;
  scorePercent: number | null;
  attemptNumber: number;
};

const STUDENT_INCLUDE = {
  user: true,
  _count: { select: { enrollments: true } },
} satisfies Prisma.StudentInclude;

type StudentWithUser = Prisma.StudentGetPayload<{ include: typeof STUDENT_INCLUDE }>;

/**
 * Domain logic for the `Student` aggregate: Master-facing listings and the
 * Student dashboard summary. Profile read/write is centralized in
 * `ProfileService` to avoid duplicating "update User + role table" logic
 * across Students and Tutors.
 */
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPaginated(query: PaginationQueryDto): Promise<PaginatedResult<StudentResponseDto>> {
    const where: Prisma.StudentWhereInput = query.search
      ? {
          user: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        }
      : {};

    const [students, totalItems] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: STUDENT_INCLUDE,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.student.count({ where }),
    ]);

    return buildPaginatedResult(
      students.map((s) => this.toResponseDto(s)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findByUserIdOrThrow(userId: string): Promise<StudentWithUser> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: STUDENT_INCLUDE,
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }

  async getDashboard(userId: string): Promise<StudentDashboardDto> {
    const student = await this.findByUserIdOrThrow(userId);

    // Students only ever see published courses (not drafts, archived or deactivated ones).
    const visibleCourse = { status: CourseStatus.PUBLISHED };

    const [recentEnrollments, recentAnnouncements, completions, enrolledCoursesCount] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { studentId: student.id, course: visibleCourse },
        include: {
          course: {
            include: {
              tutor: { include: { user: true } },
              lessons: { select: { id: true, title: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } },
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        take: 6,
      }),
      this.prisma.announcement.findMany({
        where: {
          OR: [
            { audience: 'ALL' },
            { audience: 'STUDENTS' },
            { course: { ...visibleCourse, enrollments: { some: { studentId: student.id } } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.lessonCompletion.findMany({
        where: { studentId: student.id },
        select: { lessonId: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.enrollment.count({ where: { studentId: student.id, course: visibleCourse } }),
    ]);

    const done = new Set(completions.map((c) => c.lessonId));
    const courses = recentEnrollments.map((e) => {
      const lessons = e.course.lessons;
      const nextIndex = lessons.findIndex((l) => !done.has(l.id));
      const next = nextIndex >= 0 ? lessons[nextIndex] : null;
      return {
        id: e.course.id,
        title: e.course.title,
        status: e.course.status,
        thumbnailUrl: e.course.thumbnailUrl,
        tutorName: e.course.tutor ? `${e.course.tutor.user.firstName} ${e.course.tutor.user.lastName}` : 'Unassigned',
        completedLessons: lessons.filter((l) => done.has(l.id)).length,
        totalLessons: lessons.length,
        nextLessonId: next?.id ?? null,
        nextLessonTitle: next?.title ?? null,
        nextLessonNumber: nextIndex + 1,
      };
    });

    // Resume the course worked on most recently (latest completion), else the
    // most recent enrolment that still has something left to do.
    const lastCompletedLessonId = completions[0]?.lessonId;
    const lastCourse = lastCompletedLessonId
      ? recentEnrollments.find((e) => e.course.lessons.some((l) => l.id === lastCompletedLessonId))
      : undefined;
    const candidate =
      (lastCourse ? courses.find((c) => c.id === lastCourse.course.id && c.nextLessonId) : undefined) ??
      courses.find((c) => c.nextLessonId);

    return {
      enrolledCoursesCount,
      continueLearning: candidate && candidate.nextLessonId && candidate.nextLessonTitle
        ? {
            courseId: candidate.id,
            courseTitle: candidate.title,
            lessonId: candidate.nextLessonId,
            lessonTitle: candidate.nextLessonTitle,
            lessonNumber: candidate.nextLessonNumber,
            completedLessons: candidate.completedLessons,
            totalLessons: candidate.totalLessons,
          }
        : null,
      recentCourses: courses.map(({ nextLessonNumber: _n, ...course }) => course),
      recentAnnouncements: recentAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Everything a tutor or master needs on the detail screen for one student:
   * per course, lessons done/total with a percent, which lessons are ticked
   * and how the published assessments went.
   *
   * `tutorId` scopes it to that tutor's own courses; pass `null` for the
   * master view, which spans every course. The course filter is the only
   * difference between the two routes, so both share this method.
   *
   * Batched deliberately: a handful of `in:` queries, never one per lesson or
   * per assessment.
   */
  async getProgressDetail(studentId: string, tutorId: string | null): Promise<StudentProgressDetailDto> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: STUDENT_INCLUDE,
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        ...(tutorId ? { course: { tutorId } } : {}),
      },
      include: {
        course: {
          select: { id: true, title: true, thumbnailUrl: true, progressionMode: true },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    // A tutor may only see a student they actually teach; existence is not
    // theirs to confirm, so this is a 404 rather than a 403.
    if (tutorId && enrollments.length === 0) {
      throw new NotFoundException('Student not found');
    }

    const courseIds = enrollments.map((e) => e.course.id);

    const [lessons, completions, assessments] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { courseId: { in: courseIds } },
        select: { id: true, courseId: true, title: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.lessonCompletion.findMany({
        where: { studentId: student.id, lesson: { courseId: { in: courseIds } } },
        select: { lessonId: true, completedAt: true },
      }),
      // Drafts are invisible to the student, so they are not progress.
      this.prisma.assessment.findMany({
        where: { courseId: { in: courseIds }, status: AssessmentStatus.PUBLISHED },
        select: {
          id: true,
          courseId: true,
          title: true,
          type: true,
          passPercent: true,
          orderIndex: true,
          createdAt: true,
        },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: { studentId: student.id, assessmentId: { in: assessments.map((a) => a.id) } },
      select: {
        id: true,
        assessmentId: true,
        status: true,
        scorePercent: true,
        attemptNumber: true,
        startedAt: true,
        submittedAt: true,
        gradedAt: true,
      },
      orderBy: { attemptNumber: 'asc' },
    });

    const completedAtByLesson = new Map(completions.map((c) => [c.lessonId, c.completedAt]));

    const courses = enrollments.map((enrollment) => {
      const course = enrollment.course;
      const courseLessons = lessons.filter((l) => l.courseId === course.id);
      const courseAssessments = assessments.filter((a) => a.courseId === course.id);

      const lessonDtos = courseLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        orderIndex: lesson.orderIndex,
        isCompleted: completedAtByLesson.has(lesson.id),
        completedAt: completedAtByLesson.get(lesson.id) ?? null,
      }));

      const completedLessons = lessonDtos.filter((l) => l.isCompleted).length;
      // Same rule as CoursesService.getProgress: the next lesson is the first
      // one in course order that is not done yet.
      const next = lessonDtos.find((l) => !l.isCompleted) ?? null;

      const assessmentDtos = courseAssessments.map((assessment) =>
        this.toProgressAssessmentDto(
          assessment,
          attempts.filter((att) => att.assessmentId === assessment.id),
        ),
      );

      const activity = [
        ...lessonDtos.map((l) => l.completedAt),
        // `AssessmentAttempt` has no `updatedAt` column, so an attempt's last
        // activity is the newest of the stamps it does carry.
        ...attempts
          .filter((att) => courseAssessments.some((a) => a.id === att.assessmentId))
          .flatMap((att) => [att.gradedAt, att.submittedAt, att.startedAt]),
      ].filter((d): d is Date => d !== null);

      return {
        courseId: course.id,
        courseTitle: course.title,
        thumbnailUrl: course.thumbnailUrl,
        progressionMode: course.progressionMode,
        enrolledAt: enrollment.enrolledAt,
        completedLessons,
        totalLessons: lessonDtos.length,
        percent: this.toPercent(completedLessons, lessonDtos.length),
        nextLessonId: next?.id ?? null,
        nextLessonTitle: next?.title ?? null,
        lastActivityAt:
          activity.length > 0 ? new Date(Math.max(...activity.map((d) => d.getTime()))) : null,
        lessons: lessonDtos,
        assessments: assessmentDtos,
      };
    });

    const lessonsCompleted = courses.reduce((sum, c) => sum + c.completedLessons, 0);
    const lessonsTotal = courses.reduce((sum, c) => sum + c.totalLessons, 0);
    const allAssessments = courses.flatMap((c) => c.assessments);

    return {
      student: {
        id: student.id,
        userId: student.userId,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        phone: student.phone,
        avatarUrl: student.user.avatarUrl,
        isActive: student.user.isActive,
        createdAt: student.createdAt,
      },
      totals: {
        coursesCount: courses.length,
        completedCoursesCount: courses.filter(
          (c) => c.totalLessons > 0 && c.completedLessons === c.totalLessons,
        ).length,
        lessonsCompleted,
        lessonsTotal,
        overallPercent: this.toPercent(lessonsCompleted, lessonsTotal),
        assessmentsPassed: allAssessments.filter((a) => a.status === AttemptStatus.PASSED).length,
        assessmentsTotal: allAssessments.length,
      },
      courses,
    };
  }

  private toPercent(done: number, total: number): number {
    return total > 0 ? Math.round((100 * done) / total) : 0;
  }

  /**
   * The student's standing on one assessment, from the same helper the
   * student's own assessment list uses, so staff and student can never see
   * different answers to "did they pass?".
   */
  private toProgressAssessmentDto(
    assessment: {
      id: string;
      title: string;
      type: StudentProgressCourseAssessmentDto['type'];
      passPercent: number;
    },
    myAttempts: AttemptStanding[],
  ): StudentProgressCourseAssessmentDto {
    const standing = computeAssessmentStanding(myAttempts);

    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      status: standing.status,
      passPercent: assessment.passPercent,
      bestScorePercent: standing.bestScorePercent,
      attemptsCount: standing.attemptsCount,
      latestAttemptId: standing.latestAttemptId,
    };
  }

  toResponseDto(student: StudentWithUser): StudentResponseDto {
    return {
      id: student.id,
      userId: student.userId,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      phone: student.phone,
      avatarUrl: student.user.avatarUrl,
      isActive: student.user.isActive,
      enrolledCoursesCount: student._count.enrollments,
      createdAt: student.createdAt,
    };
  }
}
