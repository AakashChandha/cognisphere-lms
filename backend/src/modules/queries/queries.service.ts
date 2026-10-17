import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, Prisma, QueryStatus, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { CreateQueryDto } from './dto/create-query.dto';
import { CreateQueryMessageDto } from './dto/create-query-message.dto';
import { QueryQueriesDto } from './dto/query-queries.dto';
import {
  QueryDetailDto,
  QueryMessageAuthorRole,
  QuerySummaryDto,
} from './dto/query-response.dto';

/** How much of the newest message a list row carries. */
const PREVIEW_LENGTH = 140;

/**
 * A list row needs the newest message only, so one extra row per thread is
 * fetched instead of the whole conversation.
 */
const QUERY_SUMMARY_INCLUDE = {
  course: { select: { id: true, title: true } },
  lesson: { select: { id: true, title: true } },
  student: {
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
  },
  _count: { select: { messages: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true } },
} satisfies Prisma.CourseQueryInclude;

const QUERY_DETAIL_INCLUDE = {
  course: { select: { id: true, title: true } },
  lesson: { select: { id: true, title: true } },
  student: {
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
  },
  _count: { select: { messages: true } },
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.CourseQueryInclude;

type QueryWithSummary = Prisma.CourseQueryGetPayload<{ include: typeof QUERY_SUMMARY_INCLUDE }>;
type QueryWithDetail = Prisma.CourseQueryGetPayload<{ include: typeof QUERY_DETAIL_INCLUDE }>;

/**
 * Which threads a staff caller may touch: a TUTOR is scoped to the courses
 * they own, a MASTER sees everything. The two staff controllers differ by
 * nothing else, so the rules live here once.
 */
export type StaffScope = 'TUTOR' | 'MASTER';

/**
 * Everything the summary mapper needs, declared structurally so both the
 * light list payload and the heavier detail payload satisfy it.
 */
interface QueryBaseSource {
  id: string;
  title: string;
  status: QueryStatus;
  courseId: string;
  lessonId: string | null;
  studentId: string;
  lastMessageAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  course: { title: string };
  lesson: { title: string } | null;
  student: { userId: string; user: { firstName: string; lastName: string } };
  _count: { messages: number };
}

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/** Single-line, ~140-character teaser of a message body. */
function toPreview(body: string): string {
  const singleLine = body.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= PREVIEW_LENGTH) {
    return singleLine;
  }

  // Cut back to a word boundary so a list row never ends mid-word.
  const clipped = singleLine.slice(0, PREVIEW_LENGTH);
  const lastSpace = clipped.lastIndexOf(' ');
  const trimmed = lastSpace > PREVIEW_LENGTH * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  // Drop a trailing stop so the row does not read "...…".
  return `${trimmed.trimEnd().replace(/[.,;:]+$/, '')}\u2026`;
}

/**
 * Owns the whole query (Q&A thread) aggregate: the student's own threads, the
 * tutor/master inbox and the reply flow. The three controllers are thin
 * role-scoped wrappers over these methods so the visibility and state rules
 * exist in exactly one place.
 *
 * Status is *who the thread is waiting on*: OPEN (a tutor), ANSWERED (the
 * student), RESOLVED (nobody - final, further messages are a 409). Only the
 * student may resolve; staff reply and never close.
 */
@Injectable()
export class QueriesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // STUDENT - own threads only
  // -------------------------------------------------------------------------

  async findAllForStudent(
    studentUserId: string,
    query: QueryQueriesDto,
  ): Promise<PaginatedResult<QuerySummaryDto>> {
    const student = await this.getStudentOrThrow(studentUserId);

    const where: Prisma.CourseQueryWhereInput = {
      studentId: student.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [queries, totalItems] = await Promise.all([
      this.prisma.courseQuery.findMany({
        where,
        include: QUERY_SUMMARY_INCLUDE,
        orderBy: { lastMessageAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.courseQuery.count({ where }),
    ]);

    return buildPaginatedResult(
      queries.map((item) => this.toSummaryDto(item)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findOneForStudent(studentUserId: string, queryId: string): Promise<QueryDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const thread = await this.prisma.courseQuery.findFirst({
      where: { id: queryId, studentId: student.id },
      include: QUERY_DETAIL_INCLUDE,
    });
    if (!thread) {
      throw new NotFoundException('Query not found');
    }
    return this.toDetailDto(thread, studentUserId);
  }

  /**
   * Raises a thread on an enrolled, published course. The thread and its
   * first message are written in one transaction, so a thread never exists
   * without the question that started it.
   */
  async createForStudent(studentUserId: string, dto: CreateQueryDto): Promise<QueryDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);

    const course = await this.prisma.course.findFirst({
      where: {
        id: dto.courseId,
        status: CourseStatus.PUBLISHED,
        deactivatedAt: null,
        enrollments: { some: { studentId: student.id } },
      },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (dto.lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: dto.lessonId, courseId: course.id },
        select: { id: true },
      });
      if (!lesson) {
        throw new BadRequestException('That lesson does not belong to this course');
      }
    }

    const now = new Date();
    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.courseQuery.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          lessonId: dto.lessonId ?? null,
          title: dto.title,
          status: QueryStatus.OPEN,
          lastMessageAt: now,
        },
        select: { id: true },
      });

      await tx.courseQueryMessage.create({
        data: { queryId: created.id, authorId: studentUserId, body: dto.body },
      });

      return tx.courseQuery.findUniqueOrThrow({
        where: { id: created.id },
        include: QUERY_DETAIL_INCLUDE,
      });
    });

    return this.toDetailDto(thread, studentUserId);
  }

  /** A student's reply puts the thread back on the tutor's queue. */
  async addStudentMessage(
    studentUserId: string,
    queryId: string,
    dto: CreateQueryMessageDto,
  ): Promise<QueryDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const thread = await this.prisma.courseQuery.findFirst({
      where: { id: queryId, studentId: student.id },
      select: { id: true, status: true },
    });
    if (!thread) {
      throw new NotFoundException('Query not found');
    }
    this.assertNotResolved(thread.status);

    const updated = await this.appendMessage(
      thread.id,
      studentUserId,
      dto.body,
      QueryStatus.OPEN,
    );
    return this.toDetailDto(updated, studentUserId);
  }

  /** Closing a thread is the student's call alone, and it is final. */
  async resolveForStudent(studentUserId: string, queryId: string): Promise<QueryDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const thread = await this.prisma.courseQuery.findFirst({
      where: { id: queryId, studentId: student.id },
      select: { id: true, status: true },
    });
    if (!thread) {
      throw new NotFoundException('Query not found');
    }
    if (thread.status === QueryStatus.RESOLVED) {
      throw new ConflictException('This query is already resolved');
    }

    const updated = await this.prisma.courseQuery.update({
      where: { id: thread.id },
      data: { status: QueryStatus.RESOLVED, resolvedAt: new Date() },
      include: QUERY_DETAIL_INCLUDE,
    });
    return this.toDetailDto(updated, studentUserId);
  }

  // -------------------------------------------------------------------------
  // STAFF - TUTOR (own courses) / MASTER (every course)
  // -------------------------------------------------------------------------

  /**
   * The staff inbox is a work queue, so OPEN threads come first (waiting on
   * us), then ANSWERED, then RESOLVED, each newest-message-first. Postgres
   * sorts an enum in declaration order and `QueryStatus` is declared
   * OPEN -> ANSWERED -> RESOLVED, so `status: 'asc'` is exactly that order.
   */
  async findAllForStaff(
    actorUserId: string,
    scope: StaffScope,
    query: QueryQueriesDto,
  ): Promise<PaginatedResult<QuerySummaryDto>> {
    const scopeWhere = await this.staffScopeWhere(actorUserId, scope);

    const where: Prisma.CourseQueryWhereInput = {
      ...scopeWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.search ? { OR: this.staffSearchFilters(query.search) } : {}),
    };

    const [queries, totalItems] = await Promise.all([
      this.prisma.courseQuery.findMany({
        where,
        include: QUERY_SUMMARY_INCLUDE,
        orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.courseQuery.count({ where }),
    ]);

    return buildPaginatedResult(
      queries.map((item) => this.toSummaryDto(item)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findOneForStaff(
    actorUserId: string,
    scope: StaffScope,
    queryId: string,
  ): Promise<QueryDetailDto> {
    const thread = await this.getStaffQueryOrThrow(actorUserId, scope, queryId);
    return this.toDetailDto(thread, actorUserId);
  }

  /** A staff reply hands the thread back to the student. Staff never resolve. */
  async addStaffMessage(
    actorUserId: string,
    scope: StaffScope,
    queryId: string,
    dto: CreateQueryMessageDto,
  ): Promise<QueryDetailDto> {
    const thread = await this.getStaffQueryOrThrow(actorUserId, scope, queryId);
    this.assertNotResolved(thread.status);

    const updated = await this.appendMessage(
      thread.id,
      actorUserId,
      dto.body,
      QueryStatus.ANSWERED,
    );
    return this.toDetailDto(updated, actorUserId);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Writes the message and moves the thread's state in one transaction. */
  private async appendMessage(
    queryId: string,
    authorUserId: string,
    body: string,
    status: QueryStatus,
  ): Promise<QueryWithDetail> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.courseQueryMessage.create({ data: { queryId, authorId: authorUserId, body } });
      return tx.courseQuery.update({
        where: { id: queryId },
        data: { status, lastMessageAt: now },
        include: QUERY_DETAIL_INCLUDE,
      });
    });
  }

  /**
   * A thread outside the caller's scope is a 404, never a 403: a tutor must
   * not be able to tell whether an id belongs to someone else's course.
   */
  private async getStaffQueryOrThrow(
    actorUserId: string,
    scope: StaffScope,
    queryId: string,
  ): Promise<QueryWithDetail> {
    const scopeWhere = await this.staffScopeWhere(actorUserId, scope);
    const thread = await this.prisma.courseQuery.findFirst({
      where: { id: queryId, ...scopeWhere },
      include: QUERY_DETAIL_INCLUDE,
    });
    if (!thread) {
      throw new NotFoundException('Query not found');
    }
    return thread;
  }

  private async staffScopeWhere(
    actorUserId: string,
    scope: StaffScope,
  ): Promise<Prisma.CourseQueryWhereInput> {
    if (scope === 'MASTER') {
      return {};
    }
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }
    return { course: { tutorId: tutor.id } };
  }

  /** Staff search matches the title, or the asking student's name or email. */
  private staffSearchFilters(search: string): Prisma.CourseQueryWhereInput[] {
    const term = search.trim();
    const contains = { contains: term, mode: 'insensitive' } as const;
    const filters: Prisma.CourseQueryWhereInput[] = [
      { title: contains },
      { student: { user: { firstName: contains } } },
      { student: { user: { lastName: contains } } },
      { student: { user: { email: contains } } },
    ];

    // "Samuel Student" would match neither name column on its own.
    const parts = term.split(/\s+/);
    if (parts.length > 1) {
      filters.push({
        student: {
          user: {
            AND: [
              { firstName: { contains: parts[0], mode: 'insensitive' } },
              { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' } },
            ],
          },
        },
      });
    }

    return filters;
  }

  private assertNotResolved(status: QueryStatus): void {
    if (status === QueryStatus.RESOLVED) {
      throw new ConflictException(
        'This query has been resolved and is closed to new messages. Raise a new query instead.',
      );
    }
  }

  private async getStudentOrThrow(userId: string): Promise<{ id: string }> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  /**
   * Labels every message author in one query instead of one per message: the
   * thread's own student is known from the thread, and the remaining (staff)
   * authors are resolved with a single `userRole` lookup.
   */
  private async resolveAuthorRoles(
    authorIds: string[],
    studentUserId: string,
  ): Promise<Map<string, QueryMessageAuthorRole>> {
    const roles = new Map<string, QueryMessageAuthorRole>();
    const staffIds = [...new Set(authorIds)].filter((id) => id !== studentUserId);
    if (staffIds.length === 0) {
      return roles;
    }

    const rows = await this.prisma.userRole.findMany({
      where: { userId: { in: staffIds } },
      select: { userId: true, role: { select: { name: true } } },
    });

    // A staff author holding MASTER is reported as MASTER, anyone else TUTOR.
    for (const id of staffIds) {
      roles.set(id, RoleName.TUTOR);
    }
    for (const row of rows) {
      if (row.role.name === RoleName.MASTER) {
        roles.set(row.userId, RoleName.MASTER);
      }
    }
    return roles;
  }

  private toBaseDto(thread: QueryBaseSource, newestMessageBody: string): QuerySummaryDto {
    return {
      id: thread.id,
      title: thread.title,
      status: thread.status,
      courseId: thread.courseId,
      courseTitle: thread.course.title,
      lessonId: thread.lessonId,
      lessonTitle: thread.lesson?.title ?? null,
      studentId: thread.studentId,
      studentName: fullName(thread.student.user),
      messageCount: thread._count.messages,
      lastMessageAt: thread.lastMessageAt,
      lastMessagePreview: toPreview(newestMessageBody),
      createdAt: thread.createdAt,
      resolvedAt: thread.resolvedAt,
    };
  }

  private toSummaryDto(thread: QueryWithSummary): QuerySummaryDto {
    return this.toBaseDto(thread, thread.messages[0]?.body ?? '');
  }

  private async toDetailDto(
    thread: QueryWithDetail,
    callerUserId: string,
  ): Promise<QueryDetailDto> {
    const studentUserId = thread.student.userId;
    const roles = await this.resolveAuthorRoles(
      thread.messages.map((message) => message.authorId),
      studentUserId,
    );
    const newest = thread.messages[thread.messages.length - 1];

    return {
      ...this.toBaseDto(thread, newest?.body ?? ''),
      messages: thread.messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        authorId: message.authorId,
        authorName: fullName(message.author),
        authorRole:
          message.authorId === studentUserId
            ? RoleName.STUDENT
            : (roles.get(message.authorId) ?? RoleName.TUTOR),
        isMine: message.authorId === callerUserId,
      })),
      canReply: thread.status !== QueryStatus.RESOLVED,
      canResolve: callerUserId === studentUserId && thread.status !== QueryStatus.RESOLVED,
    };
  }
}
