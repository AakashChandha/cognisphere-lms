import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseStatus, FilePurpose, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { StudentsService } from '../students/students.service';
import { StudentProgressDetailDto } from '../students/dto/student-progress.dto';
import { TutorResponseDto } from './dto/tutor-response.dto';
import { TutorDashboardDto } from './dto/tutor-dashboard.dto';

const TUTOR_INCLUDE = {
  user: true,
  _count: { select: { courses: true } },
} satisfies Prisma.TutorInclude;

type TutorWithUser = Prisma.TutorGetPayload<{ include: typeof TUTOR_INCLUDE }>;

@Injectable()
export class TutorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  async findAllPaginated(query: PaginationQueryDto): Promise<PaginatedResult<TutorResponseDto>> {
    const where: Prisma.TutorWhereInput = query.search
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

    const [tutors, totalItems] = await Promise.all([
      this.prisma.tutor.findMany({
        where,
        include: TUTOR_INCLUDE,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.tutor.count({ where }),
    ]);

    return buildPaginatedResult(
      tutors.map((t) => this.toResponseDto(t)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findByUserIdOrThrow(userId: string): Promise<TutorWithUser> {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId }, include: TUTOR_INCLUDE });
    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }
    return tutor;
  }

  async getDashboard(userId: string): Promise<TutorDashboardDto> {
    const tutor = await this.findByUserIdOrThrow(userId);

    const [courseCounts, totalLessons, totalFiles, distinctStudents, courses, recentEnrollments] = await Promise.all([
      this.prisma.course.groupBy({
        by: ['status'],
        where: { tutorId: tutor.id },
        _count: true,
      }),
      this.prisma.lesson.count({ where: { course: { tutorId: tutor.id } } }),
      // Lesson material only: study materials, question papers, student
      // submissions and cover images all share this table now.
      this.prisma.courseFile.count({
        where: { course: { tutorId: tutor.id }, purpose: FilePurpose.LESSON_MATERIAL },
      }),
      this.prisma.enrollment.findMany({
        where: { course: { tutorId: tutor.id } },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
      this.prisma.course.findMany({
        where: { tutorId: tutor.id },
        include: { _count: { select: { lessons: true, enrollments: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.enrollment.findMany({
        where: { course: { tutorId: tutor.id } },
        include: { student: { include: { user: true } }, course: { select: { id: true, title: true } } },
        orderBy: { enrolledAt: 'desc' },
        take: 5,
      }),
    ]);

    const countByStatus = (status: CourseStatus) =>
      courseCounts.find((c) => c.status === status)?._count ?? 0;

    const summarise = (c: (typeof courses)[number]) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      lessonsCount: c._count.lessons,
      enrollmentsCount: c._count.enrollments,
      updatedAt: c.updatedAt,
    });

    return {
      totalCourses: tutor._count.courses,
      draftCourses: countByStatus(CourseStatus.DRAFT),
      publishedCourses: countByStatus(CourseStatus.PUBLISHED),
      archivedCourses: countByStatus(CourseStatus.ARCHIVED),
      totalStudents: distinctStudents.length,
      totalLessons,
      totalFiles,
      needsAttention: courses
        .filter(
          (c) =>
            c.status === CourseStatus.DRAFT ||
            (c.status === CourseStatus.PUBLISHED && c._count.enrollments === 0),
        )
        .slice(0, 5)
        .map(summarise),
      recentCourses: courses.slice(0, 5).map(summarise),
      recentEnrollments: recentEnrollments.map((e) => ({
        studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
        courseId: e.course.id,
        courseTitle: e.course.title,
        enrolledAt: e.enrolledAt,
      })),
    };
  }

  async listStudentsForTutor(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<StudentResponseDto>> {
    const tutor = await this.findByUserIdOrThrow(userId);

    const where: Prisma.StudentWhereInput = {
      enrollments: { some: { course: { tutorId: tutor.id } } },
      ...(query.search
        ? {
            user: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [students, totalItems] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: { user: true, _count: { select: { enrollments: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.student.count({ where }),
    ]);

    return buildPaginatedResult(
      students.map((s) => ({
        id: s.id,
        userId: s.userId,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        phone: s.phone,
        avatarUrl: s.user.avatarUrl,
        isActive: s.user.isActive,
        enrolledCoursesCount: s._count.enrollments,
        createdAt: s.createdAt,
      })),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  /**
   * One student's progress, scoped to the courses this tutor owns. The master
   * route runs the identical computation unscoped, so the work lives in
   * `StudentsService.getProgressDetail` and only the filter differs.
   */
  async getStudentProgressDetail(userId: string, studentId: string): Promise<StudentProgressDetailDto> {
    const tutor = await this.findByUserIdOrThrow(userId);
    return this.studentsService.getProgressDetail(studentId, tutor.id);
  }

  toResponseDto(tutor: TutorWithUser): TutorResponseDto {
    return {
      id: tutor.id,
      userId: tutor.userId,
      firstName: tutor.user.firstName,
      lastName: tutor.user.lastName,
      email: tutor.user.email,
      phone: tutor.phone,
      expertise: tutor.expertise,
      avatarUrl: tutor.user.avatarUrl,
      isActive: tutor.user.isActive,
      coursesCount: tutor._count.courses,
      createdAt: tutor.createdAt,
    };
  }
}
