import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CourseStatus, Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CoursesService } from '../courses/courses.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { LocalStorageService } from '../storage/local-storage.service';
import { CourseFileResponseDto } from './dto/course-file-response.dto';
import { FileStreamUrlDto } from './dto/file-stream-url.dto';

const FILE_INCLUDE = { course: { select: { id: true, title: true, tutorId: true } } } satisfies Prisma.CourseFileInclude;
type CourseFileWithCourse = Prisma.CourseFileGetPayload<{ include: typeof FILE_INCLUDE }>;

export interface UploadFileArgs {
  /** Where Multer streamed the upload to (inside the storage volume). */
  tempPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Students can only ever *view* material in the browser (no downloads), so
 * the only types worth accepting are the ones the student UI can render:
 * PDF, PowerPoint (.pptx) and MP4/WebM video.
 */
const ALLOWED_EXTENSIONS = new Set(['pdf', 'pptx', 'mp4', 'm4v', 'webm']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/x-m4v',
  'video/webm',
]);

export function isAllowedUploadType(originalName: string, mimeType: string): boolean {
  const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
  // Browsers are inconsistent about MIME for .pptx/.m4v; accept when either
  // the extension or the declared type is one we can display.
  return ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has((mimeType || '').toLowerCase());
}

type FileViewerRole = 'TUTOR' | 'STUDENT' | 'MASTER';

/** Payload of the short-lived token embedded in a signed stream URL. */
interface StreamTokenPayload {
  sub: string;
  fileId: string;
  type: 'stream';
}

@Injectable()
export class CourseFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly config: AppConfigService,
    private readonly jwtService: JwtService,
    private readonly localStorage: LocalStorageService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async uploadForTutor(
    tutorUserId: string,
    courseId: string,
    lessonId: string | undefined,
    file: UploadFileArgs,
  ): Promise<CourseFileResponseDto> {
    // Multer has already written the upload to disk. Whatever fails below,
    // the temp file must not be left behind on the volume.
    let storageKey: string | undefined;
    try {
      await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId);

      if (file.sizeBytes > this.config.storage.maxFileSizeBytes) {
        throw new BadRequestException('File exceeds the maximum allowed size');
      }

      if (!isAllowedUploadType(file.originalName, file.mimeType)) {
        throw new BadRequestException(
          'Only PDF, PowerPoint (.pptx) and MP4 video can be uploaded, because students view material in the browser.',
        );
      }

      if (lessonId) {
        const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
        if (!lesson || lesson.courseId !== courseId) {
          throw new BadRequestException('Lesson does not belong to this course');
        }
      }

      ({ storageKey } = await this.storage.upload({
        tempPath: file.tempPath,
        originalName: file.originalName,
        mimeType: file.mimeType,
        folder: `courses/${courseId}`,
      }));
    } catch (error) {
      await this.localStorage.discardTemp(file.tempPath);
      throw error;
    }

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

  /** Files across the tutor's courses; a Master sees every file. */
  async findAllForTutor(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    const isMaster =
      (await this.prisma.userRole.count({ where: { userId, role: { name: RoleName.MASTER } } })) > 0;
    let courseFilter: Prisma.CourseFileWhereInput = {};
    if (!isMaster) {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
      if (!tutor) {
        throw new NotFoundException('Tutor profile not found');
      }
      courseFilter = { course: { tutorId: tutor.id } };
    }

    const where: Prisma.CourseFileWhereInput = {
      ...courseFilter,
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
      course: { status: CourseStatus.PUBLISHED, enrollments: { some: { studentId: student.id } } },
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
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId, { forRead: true });
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

  async findAllForCourseForMaster(
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseFileResponseDto>> {
    return this.paginateForCourse(courseId, query, 'MASTER');
  }

  async getForMaster(fileId: string): Promise<CourseFileWithCourse> {
    return this.getFileOrThrow(fileId);
  }

  async createStreamUrlForMaster(masterUserId: string, fileId: string): Promise<FileStreamUrlDto> {
    const file = await this.getFileOrThrow(fileId);
    return this.signStreamUrl(masterUserId, file.id);
  }

  private async paginateForCourse(
    courseId: string,
    query: PaginationQueryDto,
    role: FileViewerRole,
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

  /** Attach a file to a lesson of the same course, or detach it (lessonId null). */
  async setLessonForTutor(
    tutorUserId: string,
    fileId: string,
    lessonId: string | null,
  ): Promise<CourseFileResponseDto> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, file.courseId);

    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
      if (!lesson || lesson.courseId !== file.courseId) {
        throw new BadRequestException('Lesson does not belong to this course');
      }
    }

    const updated = await this.prisma.courseFile.update({
      where: { id: fileId },
      data: { lessonId },
      include: FILE_INCLUDE,
    });
    return this.toResponseDto(updated, 'TUTOR');
  }

  async removeForTutor(tutorUserId: string, fileId: string): Promise<void> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, file.courseId);

    await this.storage.delete(file.storageKey);
    await this.prisma.courseFile.delete({ where: { id: fileId } });
  }

  async getForTutorDownload(tutorUserId: string, fileId: string): Promise<CourseFileWithCourse> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, file.courseId, { forRead: true });
    return file;
  }

  async getForStudentDownload(studentUserId: string, fileId: string): Promise<CourseFileWithCourse> {
    const file = await this.getFileOrThrow(fileId);
    await this.coursesService.assertStudentEnrolled(studentUserId, file.courseId);
    return file;
  }

  /**
   * Issue a signed, single-file URL a student's browser can open directly
   * (video player, PDF iframe). Enrollment is checked here, once; the stream
   * route then only has to verify the token.
   */
  async createStreamUrlForStudent(studentUserId: string, fileId: string): Promise<FileStreamUrlDto> {
    const file = await this.getForStudentDownload(studentUserId, fileId);
    return this.signStreamUrl(studentUserId, file.id);
  }

  async createStreamUrlForTutor(tutorUserId: string, fileId: string): Promise<FileStreamUrlDto> {
    const file = await this.getForTutorDownload(tutorUserId, fileId);
    return this.signStreamUrl(tutorUserId, file.id);
  }

  /** Resolve the file a stream token grants access to, or reject it. */
  async getForStreamToken(token: string, fileId: string): Promise<CourseFileWithCourse> {
    let payload: StreamTokenPayload;
    try {
      payload = this.jwtService.verify<StreamTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('This link has expired. Reopen the file to get a new one.');
    }

    if (payload.type !== 'stream' || payload.fileId !== fileId) {
      throw new UnauthorizedException('Stream token does not match this file');
    }

    return this.getFileOrThrow(fileId);
  }

  private signStreamUrl(userId: string, fileId: string): FileStreamUrlDto {
    const expiresInSeconds = this.config.storage.streamUrlTtlSeconds;
    const payload: StreamTokenPayload = { sub: userId, fileId, type: 'stream' };
    const token = this.jwtService.sign(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: expiresInSeconds,
    });

    return {
      url: `/api/files/stream/${fileId}?token=${encodeURIComponent(token)}`,
      expiresInSeconds,
    };
  }

  private async getFileOrThrow(fileId: string): Promise<CourseFileWithCourse> {
    const file = await this.prisma.courseFile.findUnique({ where: { id: fileId }, include: FILE_INCLUDE });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  toResponseDto(file: CourseFileWithCourse, role: FileViewerRole): CourseFileResponseDto {
    const base = role === 'TUTOR' ? '/api/tutor/files' : role === 'MASTER' ? '/api/master/files' : '/api/student/files';
    return {
      id: file.id,
      courseId: file.courseId,
      courseTitle: file.course.title,
      lessonId: file.lessonId,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      downloadUrl: role === 'TUTOR' ? `${base}/${file.id}/stream` : `${base}/${file.id}`,
      streamUrlEndpoint: `${base}/${file.id}/stream-url`,
      createdAt: file.createdAt,
    };
  }
}
