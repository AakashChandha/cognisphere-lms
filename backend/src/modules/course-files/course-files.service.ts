import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, FilePurpose, Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CoursesService } from '../courses/courses.service';
import { LessonsService } from '../lessons/lessons.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { LocalStorageService } from '../storage/local-storage.service';
import { StreamTokenService } from '../storage/stream-token.service';
import { CourseFileResponseDto } from './dto/course-file-response.dto';
import { FileStreamUrlDto } from './dto/file-stream-url.dto';
import { StudyMaterialResponseDto } from './dto/study-material-response.dto';
import { QueryStudyMaterialDto } from './dto/query-study-material.dto';
import { UploadStudyMaterialDto } from './dto/upload-study-material.dto';
import { UpdateStudyMaterialDto } from './dto/update-study-material.dto';
import { FileViewedResponseDto } from './dto/file-viewed-response.dto';
import { CourseThumbnailResponseDto } from './dto/course-thumbnail-response.dto';

const FILE_INCLUDE = { course: { select: { id: true, title: true, tutorId: true } } } satisfies Prisma.CourseFileInclude;
type CourseFileWithCourse = Prisma.CourseFileGetPayload<{ include: typeof FILE_INCLUDE }>;

const STUDY_MATERIAL_INCLUDE = {
  course: { select: { id: true, title: true, tutorId: true } },
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.CourseFileInclude;
type StudyMaterialWithRelations = Prisma.CourseFileGetPayload<{ include: typeof STUDY_MATERIAL_INCLUDE }>;

/**
 * Every pre-existing listing in this module serves *lesson/course material*
 * only. `CourseFile` now also stores study materials, question papers,
 * submissions and cover images, so each of those queries has to say so
 * explicitly or the tutor's file manager and the student lesson pages start
 * showing other people's paperwork.
 */
const LESSON_MATERIAL_ONLY = { purpose: FilePurpose.LESSON_MATERIAL } as const;

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

/** Cover images are rendered in an `<img>`, so only web-safe raster formats. */
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

export type FileViewerRole = 'TUTOR' | 'STUDENT' | 'MASTER';

@Injectable()
export class CourseFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly lessonsService: LessonsService,
    private readonly config: AppConfigService,
    private readonly localStorage: LocalStorageService,
    private readonly streamTokens: StreamTokenService,
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
        purpose: FilePurpose.LESSON_MATERIAL,
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
    let courseFilter: Prisma.CourseFileWhereInput = {};
    if (!(await this.isMaster(userId))) {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
      if (!tutor) {
        throw new NotFoundException('Tutor profile not found');
      }
      courseFilter = { course: { tutorId: tutor.id } };
    }

    const where: Prisma.CourseFileWhereInput = {
      ...LESSON_MATERIAL_ONLY,
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
      ...LESSON_MATERIAL_ONLY,
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
      ...LESSON_MATERIAL_ONLY,
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
    const file = await this.getFileOrThrow(fileId, FilePurpose.LESSON_MATERIAL);
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
    // Lesson material only: study materials, question papers, submissions and
    // thumbnails are deleted through their own routes, which audit differently.
    const file = await this.getFileOrThrow(fileId, FilePurpose.LESSON_MATERIAL);
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
    // Enrollment alone is not enough here: question papers and *other
    // students'* submissions also hang off a course this student is enrolled
    // in. Those have their own role-scoped routes.
    if (file.purpose !== FilePurpose.LESSON_MATERIAL && file.purpose !== FilePurpose.STUDY_MATERIAL) {
      throw new NotFoundException('File not found');
    }
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

  // -------------------------------------------------------------------------
  // Study materials (purpose = STUDY_MATERIAL)
  //
  // Reference files (books, standards, past papers) attached to a course but
  // not to any lesson. Same upload/stream/delete pipeline as lesson material;
  // only the `purpose`, `title` and `description` differ.
  // -------------------------------------------------------------------------

  async uploadStudyMaterial(
    actorUserId: string,
    courseId: string,
    dto: UploadStudyMaterialDto,
    file: UploadFileArgs,
    role: FileViewerRole = 'TUTOR',
  ): Promise<StudyMaterialResponseDto> {
    let storageKey: string | undefined;
    try {
      await this.coursesService.assertTutorOwnsCourse(actorUserId, courseId);

      if (file.sizeBytes > this.config.storage.maxFileSizeBytes) {
        throw new BadRequestException('File exceeds the maximum allowed size');
      }

      if (!isAllowedUploadType(file.originalName, file.mimeType)) {
        throw new BadRequestException(
          'Only PDF, PowerPoint (.pptx) and MP4 video can be uploaded, because students view material in the browser.',
        );
      }

      ({ storageKey } = await this.storage.upload({
        tempPath: file.tempPath,
        originalName: file.originalName,
        mimeType: file.mimeType,
        folder: `courses/${courseId}/study-materials`,
      }));
    } catch (error) {
      await this.localStorage.discardTemp(file.tempPath);
      throw error;
    }

    const record = await this.prisma.courseFile.create({
      data: {
        courseId,
        lessonId: null,
        uploadedById: actorUserId,
        originalName: file.originalName,
        storageKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        purpose: FilePurpose.STUDY_MATERIAL,
        title: dto.title,
        description: dto.description ?? null,
      },
      include: STUDY_MATERIAL_INCLUDE,
    });

    return this.toStudyMaterialDto(record, role);
  }

  /** A tutor sees the study materials of their own courses; a Master sees all. */
  async findAllStudyMaterialsForStaff(
    actorUserId: string,
    query: QueryStudyMaterialDto,
    role: FileViewerRole = 'TUTOR',
  ): Promise<PaginatedResult<StudyMaterialResponseDto>> {
    let courseFilter: Prisma.CourseFileWhereInput = {};
    if (!(await this.isMaster(actorUserId))) {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId: actorUserId } });
      if (!tutor) {
        throw new NotFoundException('Tutor profile not found');
      }
      courseFilter = { course: { tutorId: tutor.id } };
    }

    return this.paginateStudyMaterials(
      {
        purpose: FilePurpose.STUDY_MATERIAL,
        ...courseFilter,
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...this.studyMaterialSearch(query.search),
      },
      query,
      role,
    );
  }

  /** Students only ever see the study materials of courses they are enrolled in. */
  async findAllStudyMaterialsForStudent(
    studentUserId: string,
    query: QueryStudyMaterialDto,
  ): Promise<PaginatedResult<StudyMaterialResponseDto>> {
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return this.paginateStudyMaterials(
      {
        purpose: FilePurpose.STUDY_MATERIAL,
        course: { status: CourseStatus.PUBLISHED, enrollments: { some: { studentId: student.id } } },
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...this.studyMaterialSearch(query.search),
      },
      query,
      'STUDENT',
    );
  }

  async updateStudyMaterial(
    actorUserId: string,
    fileId: string,
    dto: UpdateStudyMaterialDto,
    role: FileViewerRole = 'TUTOR',
  ): Promise<StudyMaterialResponseDto> {
    const material = await this.getStudyMaterialOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(actorUserId, material.courseId);

    if (dto.courseId && dto.courseId !== material.courseId) {
      // Moving a resource to another course needs rights on the destination too.
      await this.coursesService.assertTutorOwnsCourse(actorUserId, dto.courseId);
    }

    const updated = await this.prisma.courseFile.update({
      where: { id: fileId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.courseId ? { courseId: dto.courseId } : {}),
      },
      include: STUDY_MATERIAL_INCLUDE,
    });

    return this.toStudyMaterialDto(updated, role);
  }

  async removeStudyMaterial(actorUserId: string, fileId: string): Promise<void> {
    const material = await this.getStudyMaterialOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(actorUserId, material.courseId);

    await this.storage.delete(material.storageKey);
    await this.prisma.courseFile.delete({ where: { id: fileId } });
  }

  async createStudyMaterialStreamUrlForStaff(
    actorUserId: string,
    fileId: string,
  ): Promise<FileStreamUrlDto> {
    const material = await this.getStudyMaterialOrThrow(fileId);
    await this.coursesService.assertTutorOwnsCourse(actorUserId, material.courseId, { forRead: true });
    return this.signStreamUrl(actorUserId, material.id);
  }

  async createStudyMaterialStreamUrlForStudent(
    studentUserId: string,
    fileId: string,
  ): Promise<FileStreamUrlDto> {
    const material = await this.getStudyMaterialOrThrow(fileId);
    await this.coursesService.assertStudentEnrolled(studentUserId, material.courseId);
    return this.signStreamUrl(studentUserId, material.id);
  }

  // -------------------------------------------------------------------------
  // Course thumbnails (purpose = COURSE_THUMBNAIL)
  // -------------------------------------------------------------------------

  /**
   * Replace the course cover image. The previous upload is deleted, so a
   * course never keeps more than one thumbnail row on disk.
   */
  async uploadThumbnail(
    actorUserId: string,
    courseId: string,
    file: UploadFileArgs,
  ): Promise<CourseThumbnailResponseDto> {
    let storageKey: string | undefined;
    try {
      await this.coursesService.assertTutorOwnsCourse(actorUserId, courseId);

      if (!ALLOWED_IMAGE_MIME_TYPES.has((file.mimeType || '').toLowerCase())) {
        throw new BadRequestException('A cover image must be a JPEG, PNG or WebP image');
      }

      if (file.sizeBytes > MAX_THUMBNAIL_BYTES) {
        throw new BadRequestException('A cover image may not be larger than 5 MB');
      }

      ({ storageKey } = await this.storage.upload({
        tempPath: file.tempPath,
        originalName: file.originalName,
        mimeType: file.mimeType,
        folder: `courses/${courseId}/thumbnails`,
      }));
    } catch (error) {
      await this.localStorage.discardTemp(file.tempPath);
      throw error;
    }

    const created = await this.prisma.courseFile.create({
      data: {
        courseId,
        lessonId: null,
        uploadedById: actorUserId,
        originalName: file.originalName,
        storageKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        purpose: FilePurpose.COURSE_THUMBNAIL,
      },
    });

    await this.deletePreviousThumbnails(courseId, created.id);

    const thumbnailUrl = `/api/files/thumbnail/${created.id}`;
    await this.prisma.course.update({ where: { id: courseId }, data: { thumbnailUrl } });

    return { thumbnailUrl };
  }

  async removeThumbnail(actorUserId: string, courseId: string): Promise<CourseThumbnailResponseDto> {
    await this.coursesService.assertTutorOwnsCourse(actorUserId, courseId);

    await this.deletePreviousThumbnails(courseId);
    await this.prisma.course.update({ where: { id: courseId }, data: { thumbnailUrl: null } });

    return { thumbnailUrl: null };
  }

  /**
   * Resolve a cover image for the unauthenticated `/files/thumbnail/:id`
   * route. Only COURSE_THUMBNAIL rows are reachable this way: a cover image
   * is not protected IP, while course material always stays behind a signed
   * token.
   */
  async getThumbnailForPublicStream(fileId: string): Promise<CourseFileWithCourse> {
    return this.getFileOrThrow(fileId, FilePurpose.COURSE_THUMBNAIL);
  }

  private async deletePreviousThumbnails(courseId: string, keepFileId?: string): Promise<void> {
    const previous = await this.prisma.courseFile.findMany({
      where: {
        courseId,
        purpose: FilePurpose.COURSE_THUMBNAIL,
        ...(keepFileId ? { id: { not: keepFileId } } : {}),
      },
      select: { id: true, storageKey: true },
    });

    for (const old of previous) {
      await this.storage.delete(old.storageKey);
    }
    if (previous.length > 0) {
      await this.prisma.courseFile.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
    }
  }

  // -------------------------------------------------------------------------
  // File views (progression)
  // -------------------------------------------------------------------------

  /**
   * The browser calls this once it has shown the student the end of a file
   * (last PDF page, last slide, ~95% of a video). Idempotent. When this was
   * the lesson's last unseen file the server writes the `LessonCompletion`
   * itself, so the student never has to press anything.
   */
  async markFileViewedForStudent(
    studentUserId: string,
    fileId: string,
  ): Promise<FileViewedResponseDto> {
    const file = await this.getFileOrThrow(fileId);
    // Throws 403 when the student is not enrolled in the file's course.
    await this.coursesService.assertStudentEnrolled(studentUserId, file.courseId);

    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    if (file.purpose !== FilePurpose.LESSON_MATERIAL && file.purpose !== FilePurpose.STUDY_MATERIAL) {
      throw new BadRequestException('This file is not study material');
    }

    if (file.lessonId) {
      // A locked lesson must not be progressed through by calling this
      // endpoint directly.
      if (await this.lessonsService.isLessonLockedForStudent(student.id, file.lessonId)) {
        throw new ForbiddenException('Finish the earlier lessons of this course first');
      }
    }

    await this.prisma.fileView.upsert({
      where: { studentId_fileId: { studentId: student.id, fileId } },
      create: { studentId: student.id, fileId },
      update: {},
    });

    const lessonCompleted = file.lessonId
      ? await this.lessonsService.syncCompletionFromFileViews(student.id, file.lessonId)
      : false;

    return { lessonCompleted };
  }

  private studyMaterialSearch(search?: string): Prisma.CourseFileWhereInput {
    if (!search) return {};
    return {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private async paginateStudyMaterials(
    where: Prisma.CourseFileWhereInput,
    query: QueryStudyMaterialDto,
    role: FileViewerRole,
  ): Promise<PaginatedResult<StudyMaterialResponseDto>> {
    const [files, totalItems] = await Promise.all([
      this.prisma.courseFile.findMany({
        where,
        include: STUDY_MATERIAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.courseFile.count({ where }),
    ]);

    return buildPaginatedResult(
      files.map((f) => this.toStudyMaterialDto(f, role)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  private async getStudyMaterialOrThrow(fileId: string): Promise<StudyMaterialWithRelations> {
    const file = await this.prisma.courseFile.findUnique({
      where: { id: fileId },
      include: STUDY_MATERIAL_INCLUDE,
    });
    if (!file || file.purpose !== FilePurpose.STUDY_MATERIAL) {
      throw new NotFoundException('Study material not found');
    }
    return file;
  }

  private async isMaster(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { name: RoleName.MASTER } },
    });
    return count > 0;
  }

  private toStudyMaterialDto(
    file: StudyMaterialWithRelations,
    role: FileViewerRole,
  ): StudyMaterialResponseDto {
    const base = role === 'STUDENT' ? '/api/student' : role === 'MASTER' ? '/api/master' : '/api/tutor';
    return {
      id: file.id,
      // `title` is required on upload; fall back to the file name for safety.
      title: file.title ?? file.originalName,
      description: file.description,
      courseId: file.courseId,
      courseTitle: file.course.title,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy: file.uploadedBy
        ? {
            id: file.uploadedBy.id,
            firstName: file.uploadedBy.firstName,
            lastName: file.uploadedBy.lastName,
          }
        : null,
      streamUrlEndpoint: `${base}/study-materials/${file.id}/stream-url`,
      createdAt: file.createdAt,
    };
  }

  /** Resolve the file a stream token grants access to, or reject it. */
  async getForStreamToken(token: string, fileId: string): Promise<CourseFileWithCourse> {
    this.streamTokens.verify(token, fileId);
    return this.getFileOrThrow(fileId);
  }

  /** Delegated so the token scheme has exactly one implementation. */
  private signStreamUrl(userId: string, fileId: string): FileStreamUrlDto {
    return this.streamTokens.sign(userId, fileId);
  }

  /**
   * `purpose` is passed by every caller that belongs to one list only (the
   * lesson-material file manager, study materials, thumbnails), so a file id
   * from one feature can never be driven through another feature's routes.
   */
  private async getFileOrThrow(fileId: string, purpose?: FilePurpose): Promise<CourseFileWithCourse> {
    const file = await this.prisma.courseFile.findUnique({ where: { id: fileId }, include: FILE_INCLUDE });
    if (!file || (purpose && file.purpose !== purpose)) {
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
