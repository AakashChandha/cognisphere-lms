import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CoursesService } from '../courses/courses.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { CourseFileResponseDto } from './dto/course-file-response.dto';

const FILE_INCLUDE = { course: { select: { id: true, title: true, tutorId: true } } } satisfies Prisma.CourseFileInclude;
type CourseFileWithCourse = Prisma.CourseFileGetPayload<{ include: typeof FILE_INCLUDE }>;

export interface UploadFileArgs {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class CourseFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly config: AppConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async uploadForTutor(
    tutorUserId: string,
    courseId: string,
    lessonId: string | undefined,
    file: UploadFileArgs,
  ): Promise<CourseFileResponseDto> {
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId);

    if (file.sizeBytes > this.config.storage.maxFileSizeBytes) {
      throw new BadRequestException('File exceeds the maximum allowed size');
    }

    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
      if (!lesson || lesson.courseId !== courseId) {
        throw new BadRequestException('Lesson does not belong to this course');
      }
    }

    const { storageKey } = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalName,
      mimeType: file.mimeType,
      folder: `courses/${courseId}`,
    });

    const record = await this.prisma.courseFile.create({
      data: {
        courseId,
        lessonId,
        uploadedById: tutorUserId,
        originalName: file.originalName,
        storageKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
      include: FILE_INCLUDE,
    });

    return this.toResponseDto(record, 'TUTOR');
  }

  async findAllForTutor(
    tutorUserId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId: tutorUserId } });
    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }

    const where: Prisma.CourseFileWhereInput = {
      course: { tutorId: tutor.id },
      ...(query.search ? { originalName: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [files, totalItems] = await Promise.all([
      this.prisma.courseFile.findMany({
        where,
        include: FILE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.courseFile.count({ where }),
    ]);

    return buildPaginatedResult(
      files.map((f) => this.toResponseDto(f, 'TUTOR')),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findAllForStudent(
    studentUserId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const where: Prisma.CourseFileWhereInput = {
      course: { enrollments: { some: { studentId: student.id } } },
      ...(query.search ? { originalName: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [files, totalItems] = await Promise.all([
      this.prisma.courseFile.findMany({
        where,
        include: FILE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.courseFile.count({ where }),
    ]);

    return buildPaginatedResult(
      files.map((f) => this.toResponseDto(f, 'STUDENT')),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findAllForCourseForTutor(
    tutorUserId: string,
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId);
    return this.paginateForCourse(courseId, query, 'TUTOR');
  }

  async findAllForCourseForStudent(
    studentUserId: string,
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    await this.coursesService.assertStudentEnrolled(studentUserId, courseId);
    return this.paginateForCourse(courseId, query, 'STUDENT');
  }

  private async paginateForCourse(
    courseId: string,
    query: PaginationQueryDto,
    role: 'TUTOR' | 'STUDENT',
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    const where: Prisma.CourseFileWhereInput = {
      courseId,
      ...(query.search ? { originalName: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [files, totalItems] = await Promise.all([
      this.prisma.courseFile.findMany({
        where,
        include: FILE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.courseFile.count({ where }),
    ]);

    return buildPaginatedResult(
      files.map((f) => this.toResponseDto(f, role)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async removeForTutor(tutorUserId: string, fileId: string): Promise<void> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, file.courseId);

    await this.storage.delete(file.storageKey);
    await this.prisma.courseFile.delete({ where: { id: fileId } });
  }

  async getForTutorDownload(tutorUserId: string, fileId: string): Promise<CourseFileWithCourse> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, file.courseId);
    return file;
  }

  async getForStudentDownload(studentUserId: string, fileId: string): Promise<CourseFileWithCourse> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertStudentEnrolled(studentUserId, file.courseId);
    return file;
  }

  private async getFileOrThrow(fileId: string): Promise<CourseFileWithCourse> {
    const file = await this.prisma.courseFile.findUnique({ where: { id: fileId }, include: FILE_INCLUDE });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  toResponseDto(file: CourseFileWithCourse, role: 'TUTOR' | 'STUDENT'): CourseFileResponseDto {
    return {
      id: file.id,
      courseId: file.courseId,
      courseTitle: file.course.title,
      lessonId: file.lessonId,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      downloadUrl:
        role === 'TUTOR' ? `/api/tutor/files/${file.id}/stream` : `/api/student/files/${file.id}`,
      createdAt: file.createdAt,
    };
  }
}
