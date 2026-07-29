import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { TutorResponseDto } from './dto/tutor-response.dto';
import { TutorDashboardDto } from './dto/tutor-dashboard.dto';

const TUTOR_INCLUDE = {
  user: true,
  _count: { select: { courses: true } },
} satisfies Prisma.TutorInclude;

type TutorWithUser = Prisma.TutorGetPayload<{ include: typeof TUTOR_INCLUDE }>;

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [courseCounts, totalLessons, totalFiles, distinctStudents] = await Promise.all([
      this.prisma.course.groupBy({
        by: ['status'],
        where: { tutorId: tutor.id },
        _count: true,
      }),
      this.prisma.lesson.count({ where: { course: { tutorId: tutor.id } } }),
      this.prisma.courseFile.count({ where: { course: { tutorId: tutor.id } } }),
      this.prisma.enrollment.findMany({
        where: { course: { tutorId: tutor.id } },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
    ]);

    const countByStatus = (status: CourseStatus) =>
      courseCounts.find((c) => c.status === status)?._count ?? 0;

    return {
      totalCourses: tutor._count.courses,
      draftCourses: countByStatus(CourseStatus.DRAFT),
      publishedCourses: countByStatus(CourseStatus.PUBLISHED),
      archivedCourses: countByStatus(CourseStatus.ARCHIVED),
      totalStudents: distinctStudents.length,
      totalLessons,
      totalFiles,
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
