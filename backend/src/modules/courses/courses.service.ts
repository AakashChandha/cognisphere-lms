import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, FilePurpose, Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { slugify } from '../../common/utils/slug.util';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseProgressDto, CourseResponseDto } from './dto/course-response.dto';

const COURSE_INCLUDE = {
  tutor: { include: { user: true } },
  _count: {
    select: {
      lessons: true,
      // `files` now also holds study materials, question papers, submissions
      // and the cover image, none of which belong in the course's material
      // count.
      files: { where: { purpose: FilePurpose.LESSON_MATERIAL } },
      enrollments: true,
    },
  },
} satisfies Prisma.CourseInclude;

type CourseWithRelations = Prisma.CourseGetPayload<{ include: typeof COURSE_INCLUDE }>;

/**
 * Owns the `Course` aggregate lifecycle: draft -> publish -> archive, and
 * enrollment management. Shared by Tutor, Student and Master controllers so
 * the publish/ownership/visibility rules live in exactly one place.
 */
@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  /**
   * A tutor always owns the course they create. A Master may hand it to any
   * active tutor via `dto.tutorId`, or leave it unassigned (`tutorId` null).
   */
  async createForTutor(userId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    let tutorId: string | null;
    if (await this.isMaster(userId)) {
      const tutor = dto.tutorId ? await this.findAssignableTutor(dto.tutorId) : null;
      if (dto.tutorId && !tutor) {
        throw new BadRequestException('Tutor not found');
      }
      tutorId = tutor?.id ?? null;
    } else {
      tutorId = (await this.getTutorOrThrow(userId)).id;
    }
    const slug = await this.generateUniqueSlug(dto.title);

    const course = await this.prisma.course.create({
      data: {
        tutorId,
        title: dto.title,
        description: dto.description,
        thumbnailUrl: dto.thumbnailUrl,
        progressionMode: dto.progressionMode,
        slug,
        status: CourseStatus.DRAFT,
      },
      include: COURSE_INCLUDE,
    });

    return this.toResponseDto(course);
  }

  async findAllForTutor(
    userId: string,
    query: QueryCourseDto,
  ): Promise<PaginatedResult<CourseResponseDto>> {
    if (await this.isMaster(userId)) {
      return this.findAllForMaster(query);
    }
    const tutor = await this.getTutorOrThrow(userId);

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
        ...(query.unassigned === 'true' ? { tutorId: null } : {}),
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

    const result = await this.paginate(
      {
        status: CourseStatus.PUBLISHED,
        enrollments: { some: { studentId: student.id } },
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      query,
    );

    const withProgress = await Promise.all(
      result.items.map(async (course) => ({
        ...course,
        progress: await this.getProgress(student.id, course.id),
      })),
    );

    return { ...result, items: withProgress };
  }

  /** Reads are allowed on a deactivated course so the tutor can see why it is locked. */
  async findOneForTutor(userId: string, courseId: string): Promise<CourseResponseDto> {
    const course = await this.assertTutorOwnsCourse(userId, courseId, { forRead: true });
    return this.toResponseDto(course);
  }

  async findOneForStudent(studentUserId: string, courseId: string): Promise<CourseResponseDto> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    const course = await this.getCourseOrThrow(courseId);

    const isEnrolled = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student?.id ?? '', courseId } },
    });

    if (!isEnrolled || !student) {
      throw new ForbiddenException('You are not enrolled in this course');
    }
    this.assertAvailableToStudents(course);

    return { ...this.toResponseDto(course), progress: await this.getProgress(student.id, course.id) };
  }

  /**
   * How far a student is through a course. "Next" is the first lesson, in
   * course order, that is not completed yet (lessons are never locked).
   */
  async getProgress(studentId: string, courseId: string): Promise<CourseProgressDto> {
    const [lessons, completions] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { courseId },
        select: { id: true, title: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.lessonCompletion.findMany({
        where: { studentId, lesson: { courseId } },
        select: { lessonId: true },
      }),
    ]);

    const completed = new Set(completions.map((c) => c.lessonId));
    const next = lessons.find((l) => !completed.has(l.id)) ?? null;

    return {
      completedLessons: lessons.filter((l) => completed.has(l.id)).length,
      totalLessons: lessons.length,
      nextLessonId: next?.id ?? null,
      nextLessonTitle: next?.title ?? null,
    };
  }

  /** Master only: hand a course (typically one whose tutor left) to another tutor. */
  async reassignTutor(courseId: string, tutorId: string): Promise<CourseResponseDto> {
    await this.getCourseOrThrow(courseId);
    if (!(await this.findAssignableTutor(tutorId))) {
      throw new NotFoundException('Tutor not found');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { tutorId },
      include: COURSE_INCLUDE,
    });
    return this.toResponseDto(updated);
  }

  /** Master only: enrolled students of any course. */
  async listEnrolledStudentsForMaster(
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<StudentResponseDto>> {
    await this.getCourseOrThrow(courseId);
    return this.paginateEnrolledStudents(courseId, query);
  }

  async findOneForMaster(courseId: string): Promise<CourseResponseDto> {
    return this.toResponseDto(await this.getCourseOrThrow(courseId));
  }

  /**
   * Master only: pull a course out of circulation. Students stop seeing it
   * and the tutor can read but not change it until an admin reactivates.
   */
  async deactivate(courseId: string, reason: string): Promise<CourseResponseDto> {
    const course = await this.getCourseOrThrow(courseId);
    if (course.status === CourseStatus.DEACTIVATED) {
      throw new BadRequestException('Course is already deactivated');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        status: CourseStatus.DEACTIVATED,
        deactivatedAt: new Date(),
        deactivationReason: reason,
        publishedAt: null,
      },
      include: COURSE_INCLUDE,
    });
    return this.toResponseDto(updated);
  }

  /** Master only: back to draft; the course is published again through the normal flow. */
  async reactivate(courseId: string): Promise<CourseResponseDto> {
    const course = await this.getCourseOrThrow(courseId);
    if (course.status !== CourseStatus.DEACTIVATED) {
      throw new BadRequestException('Only a deactivated course can be reactivated');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.DRAFT, deactivatedAt: null, deactivationReason: null },
      include: COURSE_INCLUDE,
    });
    return this.toResponseDto(updated);
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
        progressionMode: dto.progressionMode,
      },
      include: COURSE_INCLUDE,
    });

    return this.toResponseDto(course);
  }

  async removeForTutor(tutorUserId: string, courseId: string): Promise<void> {
    await this.assertTutorOwnsCourse(tutorUserId, courseId);
    // The cascade removes the file rows but not the files, so collect them first
    // and delete them from disk once the course is gone.
    const files = await this.prisma.courseFile.findMany({ where: { courseId }, select: { storageKey: true } });
    await this.prisma.course.delete({ where: { id: courseId } });
    for (const file of files) {
      await this.storage.delete(file.storageKey);
    }
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

  /** Take a published course back to draft so students no longer see it. */
  async unpublish(tutorUserId: string, courseId: string): Promise<CourseResponseDto> {
    const course = await this.assertTutorOwnsCourse(tutorUserId, courseId);

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Only a published course can be unpublished');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.DRAFT, publishedAt: null },
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
    await this.assertTutorOwnsCourse(tutorUserId, courseId, { forRead: true });
    return this.paginateEnrolledStudents(courseId, query);
  }

  private async paginateEnrolledStudents(
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<StudentResponseDto>> {
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

  /**
   * Gate for every tutor-facing course operation (also used by Lessons,
   * CourseFiles and Announcements for nested resources).
   *
   * - A Master passes for any course, deactivated or not.
   * - A tutor must own the course. By default the call is treated as a
   *   mutation and is refused while the course is deactivated; pass
   *   `{ forRead: true }` for listings/detail so the tutor can still see it.
   */
  async assertTutorOwnsCourse(
    userId: string,
    courseId: string,
    options: { forRead?: boolean } = {},
  ): Promise<CourseWithRelations> {
    const course = await this.getCourseOrThrow(courseId);

    if (await this.isMaster(userId)) {
      return course;
    }

    const tutor = await this.getTutorOrThrow(userId);
    if (course.tutorId !== tutor.id) {
      throw new ForbiddenException('You do not have access to this course');
    }

    if (!options.forRead && course.status === CourseStatus.DEACTIVATED) {
      throw new ForbiddenException(
        `This course was deactivated by an administrator: ${course.deactivationReason ?? 'no reason given'}`,
      );
    }

    return course;
  }

  /** Students only ever get to published courses they are enrolled in. */
  async assertStudentEnrolled(studentUserId: string, courseId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    const enrollment = student
      ? await this.prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: student.id, courseId } },
          include: { course: { select: { status: true } } },
        })
      : null;

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }
    this.assertAvailableToStudents(enrollment.course);
  }

  private assertAvailableToStudents(course: { status: CourseStatus }): void {
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new ForbiddenException('This course is not available');
    }
  }

  private async isMaster(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { name: RoleName.MASTER } },
    });
    return count > 0;
  }

  /** A tutor a course may be assigned to; null when unknown, 400 when the account is disabled. */
  private async findAssignableTutor(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
    if (tutor && !tutor.user.isActive) {
      throw new BadRequestException('That tutor account is disabled. Enable it first or pick another tutor.');
    }
    return tutor;
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
      progressionMode: course.progressionMode,
      thumbnailUrl: course.thumbnailUrl,
      tutor: course.tutor
        ? {
            id: course.tutor.id,
            firstName: course.tutor.user.firstName,
            lastName: course.tutor.user.lastName,
          }
        : null,
      lessonsCount: course._count.lessons,
      filesCount: course._count.files,
      enrollmentsCount: course._count.enrollments,
      publishedAt: course.publishedAt,
      deactivatedAt: course.deactivatedAt,
      deactivationReason: course.deactivationReason,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
