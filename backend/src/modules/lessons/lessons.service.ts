import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { LessonResponseDto } from './dto/lesson-response.dto';

const LESSON_INCLUDE = {
  _count: { select: { files: true } },
} satisfies Prisma.LessonInclude;

type LessonWithCount = Prisma.LessonGetPayload<{ include: typeof LESSON_INCLUDE }>;

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

  async findForStudent(studentUserId: string, lessonId: string): Promise<LessonResponseDto> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertStudentEnrolled(studentUserId, lesson.courseId);
    const student = await this.getStudentOrThrow(studentUserId);
    const completion = await this.prisma.lessonCompletion.findUnique({
      where: { studentId_lessonId: { studentId: student.id, lessonId } },
    });
    return { ...this.toResponseDto(lesson), completed: completion !== null };
  }

  /** Idempotent: marking twice is fine, so a video "ended" event can fire freely. */
  async setCompletedForStudent(studentUserId: string, lessonId: string, completed: boolean): Promise<void> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertStudentEnrolled(studentUserId, lesson.courseId);
    const student = await this.getStudentOrThrow(studentUserId);

    if (completed) {
      await this.prisma.lessonCompletion.upsert({
        where: { studentId_lessonId: { studentId: student.id, lessonId } },
        create: { studentId: student.id, lessonId },
        update: {},
      });
    } else {
      await this.prisma.lessonCompletion.deleteMany({ where: { studentId: student.id, lessonId } });
    }
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
    const [lessons, completions] = await Promise.all([
      this.findAllForCourse(courseId),
      this.prisma.lessonCompletion.findMany({
        where: { studentId: student.id, lesson: { courseId } },
        select: { lessonId: true },
      }),
    ]);
    const done = new Set(completions.map((c) => c.lessonId));
    return lessons.map((l) => ({ ...l, completed: done.has(l.id) }));
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
