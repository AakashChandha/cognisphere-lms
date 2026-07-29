import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
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
      data: { courseId, title: dto.title, content: dto.content, orderIndex },
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

  async removeForTutor(tutorUserId: string, lessonId: string): Promise<void> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, lesson.courseId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  async findForStudent(studentUserId: string, lessonId: string): Promise<LessonResponseDto> {
    const lesson = await this.getLessonOrThrow(lessonId);
    await this.coursesService.assertStudentEnrolled(studentUserId, lesson.courseId);
    return this.toResponseDto(lesson);
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
    await this.coursesService.assertTutorOwnsCourse(tutorUserId, courseId);
    return this.findAllForCourse(courseId);
  }

  async findAllForCourseForStudent(studentUserId: string, courseId: string): Promise<LessonResponseDto[]> {
    await this.coursesService.assertStudentEnrolled(studentUserId, courseId);
    return this.findAllForCourse(courseId);
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
