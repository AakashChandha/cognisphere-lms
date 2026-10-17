import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseProgressionMode, FilePurpose, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { LessonFileDto, LessonResponseDto } from './dto/lesson-response.dto';

/**
 * `CourseFile` also stores study materials, question papers, submissions and
 * cover images, so the lesson file count must say which purpose it means or
 * a cover image would show up as a lesson attachment.
 */
const LESSON_INCLUDE = {
  _count: { select: { files: { where: { purpose: FilePurpose.LESSON_MATERIAL } } } },
} satisfies Prisma.LessonInclude;

type LessonWithCount = Prisma.LessonGetPayload<{ include: typeof LESSON_INCLUDE }>;

/** The lesson fields the lock/completion calculation needs. */
type LessonOrderRow = { id: string; orderIndex: number };

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async createForTutor(
    tutorUserId: string,
    courseId: string,
    dto: CreateLessonDto,
  ): Promise<LessonResponseDto> {
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId);

    const orderIndex = dto.orderIndex ?? (await this.prisma.lesson.count({ where: { courseId } }));

    const lesson = await this.prisma.lesson.create({
      data: { courseId, title: dto.title, content: dto.content ?? '', orderIndex },
      include: LESSON_INCLUDE,
    });

    return this.toResponseDto(lesson);
  }

  async updateForTutor(
    tutorUserId: string,
    lessonId: string,
    dto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, lesson.courseId);

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { title: dto.title, content: dto.content, orderIndex: dto.orderIndex },
      include: LESSON_INCLUDE,
    });

    return this.toResponseDto(updated);
  }

  /**
   * Persist a drag-and-drop order. Every lesson of the course must be listed
   * exactly once so a stale client can never silently drop a lesson.
   */
  async reorderForTutor(
    tutorUserId: string,
    courseId: string,
    dto: ReorderLessonsDto,
  ): Promise<LessonResponseDto[]> {
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId);

    const existing = await this.prisma.lesson.findMany({ where: { courseId }, select: { id: true } });
    const existingIds = new Set(existing.map((l) => l.id));
    const requested = new Set(dto.lessonIds);

    if (requested.size !== dto.lessonIds.length || requested.size !== existingIds.size || [...requested].some((id) => !existingIds.has(id))) {
      throw new BadRequestException('The lesson list is out of date. Refresh and try again.');
    }

    await this.prisma.$transaction(
      dto.lessonIds.map((id, orderIndex) =>
        this.prisma.lesson.update({ where: { id }, data: { orderIndex } }),
      ),
    );

    return this.findAllForCourse(courseId);
  }

  async removeForTutor(tutorUserId: string, lessonId: string): Promise<void> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, lesson.courseId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  /**
   * A single lesson as the student sees it: completion state, the lock state
   * for SEQUENTIAL courses and the per-file "seen through" flag.
   *
   * A locked lesson is a 403, not a flag on the payload, so the gate holds
   * when someone types the URL instead of clicking a card.
   */
  async findForStudent(studentUserId: string, lessonId: string): Promise<LessonResponseDto> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertStudentEnrolled(studentUserId, lesson.courseId);
    const student = await this.getStudentOrThrow(studentUserId);

    const context = await this.loadStudentCourseContext(student.id, lesson.courseId);
    const dto = this.toStudentLessonDto(lesson, context);

    if (dto.isLocked) {
      throw new ForbiddenException('Finish the earlier lessons of this course first');
    }

    return dto;
  }

  /**
   * Explicit "mark complete". Lessons that carry files normally complete
   * themselves as the student finishes the last one (see
   * `syncCompletionFromFileViews`); this call remains the only way to finish
   * a lesson that has no files at all.
   */
  async setCompletedForStudent(studentUserId: string, lessonId: string, completed: boolean): Promise<void> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertStudentEnrolled(studentUserId, lesson.courseId);
    const student = await this.getStudentOrThrow(studentUserId);

    if (completed) {
      if (await this.isLessonLockedForStudent(student.id, lessonId)) {
        throw new ConflictException(
          'This lesson is locked until every earlier lesson in the course is complete',
        );
      }

      const unviewed = await this.countUnviewedFiles(student.id, lessonId);
      if (unviewed > 0) {
        throw new ConflictException(
          'Open every file in this lesson to the end before marking it complete',
        );
      }

      await this.prisma.lessonCompletion.upsert({
        where: { studentId_lessonId: { studentId: student.id, lessonId } },
        create: { studentId: student.id, lessonId },
        update: {},
      });
    } else {
      await this.prisma.lessonCompletion.deleteMany({ where: { studentId: student.id, lessonId } });
    }
  }

  /**
   * True when the course is SEQUENTIAL and some lesson with a lower
   * `orderIndex` is still not complete for this student. Always false in a
   * FREE course.
   */
  async isLessonLockedForStudent(studentId: string, lessonId: string): Promise<boolean> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true, orderIndex: true, course: { select: { progressionMode: true } } },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.course.progressionMode !== CourseProgressionMode.SEQUENTIAL) {
      return false;
    }

    const earlierIncomplete = await this.prisma.lesson.count({
      where: {
        courseId: lesson.courseId,
        orderIndex: { lt: lesson.orderIndex },
        completions: { none: { studentId } },
      },
    });
    return earlierIncomplete > 0;
  }

  /**
   * Called after a `FileView` is recorded: if the student has now reached the
   * end of every file in the lesson, write the `LessonCompletion` so they
   * never have to press anything. Returns whether the lesson is complete.
   */
  async syncCompletionFromFileViews(studentId: string, lessonId: string): Promise<boolean> {
    const fileCount = await this.prisma.courseFile.count({
      where: { lessonId, purpose: FilePurpose.LESSON_MATERIAL },
    });
    // A lesson with no files is only ever completed by the explicit call.
    if (fileCount === 0) {
      return false;
    }

    if ((await this.countUnviewedFiles(studentId, lessonId)) > 0) {
      return false;
    }

    await this.prisma.lessonCompletion.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId },
      update: {},
    });
    return true;
  }

  /** How many of the lesson's files the student has not finished viewing. */
  private async countUnviewedFiles(studentId: string, lessonId: string): Promise<number> {
    return this.prisma.courseFile.count({
      where: {
        lessonId,
        purpose: FilePurpose.LESSON_MATERIAL,
        views: { none: { studentId } },
      },
    });
  }

  private async getStudentOrThrow(userId: string) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  async findAllForCourse(courseId: string): Promise<LessonResponseDto[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId },
      include: LESSON_INCLUDE,
      orderBy: { orderIndex: 'asc' },
    });
    return lessons.map((l) => this.toResponseDto(l));
  }

  async findAllForCourseForTutor(tutorUserId: string, courseId: string): Promise<LessonResponseDto[]> {
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId, { forRead: true });
    return this.findAllForCourse(courseId);
  }

  async findAllForCourseForStudent(studentUserId: string, courseId: string): Promise<LessonResponseDto[]> {
    await this.coursesService.assertStudentEnrolled(studentUserId, courseId);
    const student = await this.getStudentOrThrow(studentUserId);

    const [lessons, context] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { courseId },
        include: LESSON_INCLUDE,
        orderBy: { orderIndex: 'asc' },
      }),
      this.loadStudentCourseContext(student.id, courseId),
    ]);

    return lessons.map((lesson) => this.toStudentLessonDto(lesson, context));
  }

  /**
   * Everything the student view of a course's lessons needs, in one round of
   * queries: the progression mode, the lesson order, which lessons are
   * complete, and the lesson files with the student's view state.
   */
  private async loadStudentCourseContext(studentId: string, courseId: string) {
    const [course, lessons, completions, files, views] = await Promise.all([
      this.prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, progressionMode: true },
      }),
      this.prisma.lesson.findMany({
        where: { courseId },
        select: { id: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.lessonCompletion.findMany({
        where: { studentId, lesson: { courseId } },
        select: { lessonId: true },
      }),
      this.prisma.courseFile.findMany({
        where: { courseId, purpose: FilePurpose.LESSON_MATERIAL, lessonId: { not: null } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.fileView.findMany({
        where: { studentId, file: { courseId } },
        select: { fileId: true },
      }),
    ]);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return {
      courseTitle: course.title,
      progressionMode: course.progressionMode,
      lessons: lessons as LessonOrderRow[],
      completed: new Set(completions.map((c) => c.lessonId)),
      viewed: new Set(views.map((v) => v.fileId)),
      files,
    };
  }

  private toStudentLessonDto(
    lesson: LessonWithCount,
    context: Awaited<ReturnType<LessonsService['loadStudentCourseContext']>>,
  ): LessonResponseDto {
    const isCompleted = context.completed.has(lesson.id);
    const isLocked =
      context.progressionMode === CourseProgressionMode.SEQUENTIAL &&
      context.lessons.some((l) => l.orderIndex < lesson.orderIndex && !context.completed.has(l.id));

    const files: LessonFileDto[] = context.files
      .filter((f) => f.lessonId === lesson.id)
      .map((f) => ({
        id: f.id,
        courseId: f.courseId,
        courseTitle: context.courseTitle,
        lessonId: f.lessonId,
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        downloadUrl: `/api/student/files/${f.id}`,
        streamUrlEndpoint: `/api/student/files/${f.id}/stream-url`,
        isViewed: context.viewed.has(f.id),
        createdAt: f.createdAt,
      }));

    return {
      ...this.toResponseDto(lesson),
      completed: isCompleted,
      isCompleted,
      isLocked,
      files,
    };
  }

  private async getLessonOrThrow(lessonId: string): Promise<LessonWithCount & { courseId: string }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: LESSON_INCLUDE,
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  toResponseDto(lesson: LessonWithCount): LessonResponseDto {
    return {
      id: lesson.id,
      courseId: lesson.courseId,
      title: lesson.title,
      content: lesson.content,
      orderIndex: lesson.orderIndex,
      filesCount: lesson._count.files,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }
}
