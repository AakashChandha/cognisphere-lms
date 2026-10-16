import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StudentResponseDto } from './dto/student-response.dto';
import { StudentDashboardDto } from './dto/student-dashboard.dto';

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
