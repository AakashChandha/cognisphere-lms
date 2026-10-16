import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementAudience, CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';

const ANNOUNCEMENT_INCLUDE = {
  author: { select: { firstName: true, lastName: true } },
  course: { select: { title: true } },
} satisfies Prisma.AnnouncementInclude;

type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{
  include: typeof ANNOUNCEMENT_INCLUDE;
}>;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(author: AuthenticatedUser, dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    if (dto.courseId) {
      await this.assertCanManageCourse(author, dto.courseId);
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        audience: dto.audience ?? AnnouncementAudience.ALL,
        courseId: dto.courseId,
        authorId: author.id,
      },
      include: ANNOUNCEMENT_INCLUDE,
    });

    return this.toResponseDto(announcement);
  }

  async findAllForUser(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<AnnouncementResponseDto>> {
    const where = await this.buildVisibilityFilter(user, query.search);

    const [items, totalItems] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: ANNOUNCEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((a) => this.toResponseDto(a)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<AnnouncementResponseDto> {
    const announcement = await this.getOrThrow(id);
    return this.toResponseDto(announcement);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.getOrThrow(id);
    this.assertCanManageAnnouncement(user, announcement);
    if (dto.courseId && dto.courseId !== announcement.courseId) {
      await this.assertCanManageCourse(user, dto.courseId);
    }

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        audience: dto.audience,
        courseId: dto.courseId,
      },
      include: ANNOUNCEMENT_INCLUDE,
    });

    return this.toResponseDto(updated);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const announcement = await this.getOrThrow(id);
    this.assertCanManageAnnouncement(user, announcement);
    await this.prisma.announcement.delete({ where: { id } });
  }

  private assertCanManageAnnouncement(
    user: AuthenticatedUser,
    announcement: AnnouncementWithRelations,
  ): void {
    if (user.roles.includes(AppRole.MASTER)) return;
    if (announcement.authorId === user.id) return;
    throw new ForbiddenException('You do not have permission to manage this announcement');
  }

  private async assertCanManageCourse(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (user.roles.includes(AppRole.MASTER)) return;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { tutor: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!course.tutor || course.tutor.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this course');
    }

    if (course.status === CourseStatus.DEACTIVATED) {
      throw new ForbiddenException(
        `This course was deactivated by an administrator: ${course.deactivationReason ?? 'no reason given'}`,
      );
    }
  }

  private async buildVisibilityFilter(
    user: AuthenticatedUser,
    search?: string,
  ): Promise<Prisma.AnnouncementWhereInput> {
    const searchFilter: Prisma.AnnouncementWhereInput = search
      ? { title: { contains: search, mode: 'insensitive' } }
      : {};

    if (user.roles.includes(AppRole.MASTER)) {
      return searchFilter;
    }

    if (user.roles.includes(AppRole.STUDENT)) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      return {
        ...searchFilter,
        OR: [
          { audience: AnnouncementAudience.ALL },
          { audience: AnnouncementAudience.STUDENTS },
          ...(student
            ? [
                {
                  course: {
                    status: CourseStatus.PUBLISHED,
                    enrollments: { some: { studentId: student.id } },
                  },
                },
              ]
            : []),
        ],
      };
    }

    if (user.roles.includes(AppRole.TUTOR)) {
      const tutor = await this.prisma.tutor.findUnique({ where: { userId: user.id } });
      return {
        ...searchFilter,
        OR: [
          { audience: AnnouncementAudience.ALL },
          { audience: AnnouncementAudience.TUTORS },
          { authorId: user.id },
          ...(tutor ? [{ course: { tutorId: tutor.id } }] : []),
        ],
      };
    }

    return searchFilter;
  }

  private async getOrThrow(id: string): Promise<AnnouncementWithRelations> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: ANNOUNCEMENT_INCLUDE,
    });
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  toResponseDto(announcement: AnnouncementWithRelations): AnnouncementResponseDto {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      courseId: announcement.courseId,
      courseTitle: announcement.course?.title ?? null,
      authorId: announcement.authorId,
      authorName: `${announcement.author.firstName} ${announcement.author.lastName}`,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };
  }
}
