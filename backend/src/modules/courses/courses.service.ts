import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { slugify } from '../../common/utils/slug.util';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';

const COURSE_INCLUDE = {
  tutor: { include: { user: true } },
  _count: { select: { lessons: true, files: true, enrollments: true } },
} satisfies Prisma.CourseInclude;

type CourseWithRelations = Prisma.CourseGetPayload<{ include: typeof COURSE_INCLUDE }>;

/**
 * Owns the `Course` aggregate lifecycle: draft -> publish -> archive, and
 * enrollment management. Shared by Tutor, Student and Master controllers so
 * the publish/ownership/visibility rules live in exactly one place.
 */
@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForTutor(tutorUserId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const tutor = await this.getTutorOrThrow(tutorUserId);
    const slug = await this.generateUniqueSlug(dto.title);

    const course = await this.prisma.course.create({
      data: {
        tutorId: tutor.id,
        title: dto.title,
        description: dto.description,
        thumbnailUrl: dto.thumbnailUrl,
        slug,
        status: CourseStatus.DRAFT,
      },
      include: COURSE_INCLUDE,
    });

    return this.toResponseDto(course);
  }

  async findAllForTutor(
    tutorUserId: string,
    query: QueryCourseDto,
  ): Promise<PaginatedResult<CourseResponseDto>> {
    const tutor = await this.getTutorOrThrow(tutorUserId);

    return this.paginate(
      {
        tutorId: tutor.id,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      query,
    );
  }

  async findAllForMaster(query: QueryCourseDto): Promise<PaginatedResult<CourseResponseDto>> {
    return this.paginate(
      {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      query,
    );
  }

  async findEnrolledForStudent(
    studentUserId: string,
    query: QueryCourseDto,
  ): Promise<PaginatedResult<CourseResponseDto>> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return this.paginate(
      {
        enrollments: { some: { studentId: student.id } },
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      query,
    );
  }

  async findOneForTutor(tutorUserId: string, courseId: string): Promise<CourseResponseDto> {
    const tutor = await this.getTutorOrThrow(tutorUserId);
    const course = await this.getCourseOrThrow(courseId);

    if (course.tutorId !== tutor.id) {
      throw new ForbiddenException('You do not have access to this course');
    }

    return this.toResponseDto(course);
  }

  async findOneForStudent(studentUserId: string, courseId: string): Promise<CourseResponseDto> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    const course = await this.getCourseOrThrow(courseId);

    const isEnrolled = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student?.id ?? '', courseId } },
    });

    if (!isEnrolled) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    return this.toResponseDto(course);
  }

  async findOneForMaster(courseId: string): Promise<CourseResponseDto> {
    return this.toResponseDto(await this.getCourseOrThrow(courseId));
  }

  async updateForTutor(
    tutorUserId: string,
    courseId: string,
    dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);

    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        title: dto.title,
        description: dto.description,
        thumbnailUrl: dto.thumbnailUrl,
      },
      include: COURSE_INCLUDE,
    });

    return this.toResponseDto(course);
  }

  async removeForTutor(tutorUserId: string, courseId: string): Promise<void> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);
    await this.prisma.course.delete({ where: { id: courseId } });
  }

  async publish(tutorUserId: string, courseId: string): Promise<CourseResponseDto> {
    const course = await this.assertTutorOwnsCourse(tutorUserId, courseId);

    if (course.status === CourseStatus.PUBLISHED) {
      throw new BadRequestException('Course is already published');
    }

    const lessonsCount = await this.prisma.lesson.count({ where: { courseId } });
    if (lessonsCount === 0) {
      throw new BadRequestException('Add at least one lesson before publishing the course');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.PUBLISHED, publishedAt: new Date(), archivedAt: null },
      include: COURSE_INCLUDE,
    });

    return this.toResponseDto(updated);
  }

  async archive(tutorUserId: string, courseId: string): Promise<CourseResponseDto> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.ARCHIVED, archivedAt: new Date() },
      include: COURSE_INCLUDE,
    });

    return this.toResponseDto(updated);
  }

  async enrollStudent(tutorUserId: string, courseId: string, studentId: string): Promise<void> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId },
      update: {},
    });
  }

  async unenrollStudent(tutorUserId: string, courseId: string, studentId: string): Promise<void> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);
    await this.prisma.enrollment.deleteMany({ where: { studentId, courseId } });
  }

  async listEnrolledStudents(
    tutorUserId: string,
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<StudentResponseDto>> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);

    const where: Prisma.StudentWhereInput = { enrollments: { some: { courseId } } };

    const [students, totalItems] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: { user: true, _count: { select: { enrollments: true } } },
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

  /** Used by LessonsService/CourseFilesService to verify tutor ownership before mutating nested resources. */
  async assertTutorOwnsCourse(tutorUserId: string, courseId: string): Promise<CourseWithRelations> {
    const tutor = await this.getTutorOrThrow(tutorUserId);
    const course = await this.getCourseOrThrow(courseId);

    if (course.tutorId !== tutor.id) {
      throw new ForbiddenException('You do not have access to this course');
    }

    return course;
  }

  async assertStudentEnrolled(studentUserId: string, courseId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    const enrollment = student
      ? await this.prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: student.id, courseId } },
        })
      : null;

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }
  }

  private async paginate(
    where: Prisma.CourseWhereInput,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseResponseDto>> {
    const [courses, totalItems] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: COURSE_INCLUDE,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.course.count({ where }),
    ]);

    return buildPaginatedResult(
      courses.map((c) => this.toResponseDto(c)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  private async getTutorOrThrow(userId: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }
    return tutor;
  }

  private async getCourseOrThrow(courseId: string): Promise<CourseWithRelations> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: COURSE_INCLUDE,
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'course';
    const existing = await this.prisma.course.findUnique({ where: { slug: base } });
    return existing ? `${base}-${randomUUID().slice(0, 8)}` : base;
  }

  toResponseDto(course: CourseWithRelations): CourseResponseDto {
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      status: course.status,
      thumbnailUrl: course.thumbnailUrl,
      tutor: {
        id: course.tutor.id,
        firstName: course.tutor.user.firstName,
        lastName: course.tutor.user.lastName,
      },
      lessonsCount: course._count.lessons,
      filesCount: course._count.files,
      enrollmentsCount: course._count.enrollments,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
