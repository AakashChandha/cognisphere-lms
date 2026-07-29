import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const [recentEnrollments, recentAnnouncements] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { studentId: student.id },
        include: { course: true },
        orderBy: { enrolledAt: 'desc' },
        take: 5,
      }),
      this.prisma.announcement.findMany({
        where: {
          OR: [
            { audience: 'ALL' },
            { audience: 'STUDENTS' },
            { course: { enrollments: { some: { studentId: student.id } } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      enrolledCoursesCount: student._count.enrollments,
      recentCourses: recentEnrollments.map((e) => ({
        id: e.course.id,
        title: e.course.title,
        status: e.course.status,
        thumbnailUrl: e.course.thumbnailUrl,
      })),
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
