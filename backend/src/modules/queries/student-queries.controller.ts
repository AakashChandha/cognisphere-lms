import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { QueriesService } from './queries.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { CreateQueryMessageDto } from './dto/create-query-message.dto';
import { QueryQueriesDto } from './dto/query-queries.dto';
import { QueryDetailDto, QuerySummaryDto } from './dto/query-response.dto';

/**
 * The student side of queries: raise a question on an enrolled course, keep
 * talking on it, and close it when the answer landed. Everything is scoped to
 * the caller's own threads inside `QueriesService`, so another student's id is
 * a 404.
 */
@ApiTags('Students - Queries')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student/queries')
export class StudentQueriesController {
  constructor(
    private readonly queries: QueriesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My queries, newest activity first' })
  @ApiPaginatedResponse(QuerySummaryDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryQueriesDto) {
    return this.queries.findAllForStudent(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Raise a query on a course I am enrolled in' })
  async create(
    @Body() dto: CreateQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const thread = await this.queries.createForStudent(user.id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.QUERY_CREATED,
      entityType: 'CourseQuery',
      entityId: thread.id,
      metadata: { courseId: thread.courseId, lessonId: thread.lessonId },
      ipAddress: req.ip,
    });
    return { message: 'Query raised successfully', data: thread };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One of my queries, with the whole conversation' })
  @ApiOkResponse({ type: QueryDetailDto })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.findOneForStudent(user.id, id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply on my query; it goes back to waiting on a tutor' })
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateQueryMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const thread = await this.queries.addStudentMessage(user.id, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.QUERY_REPLIED,
      entityType: 'CourseQuery',
      entityId: thread.id,
      metadata: { status: thread.status },
      ipAddress: req.ip,
    });
    return { message: 'Reply sent', data: thread };
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Close my query. Final: a resolved query takes no more messages.' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const thread = await this.queries.resolveForStudent(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.QUERY_RESOLVED,
      entityType: 'CourseQuery',
      entityId: thread.id,
      ipAddress: req.ip,
    });
    return { message: 'Query marked as resolved', data: thread };
  }
}
