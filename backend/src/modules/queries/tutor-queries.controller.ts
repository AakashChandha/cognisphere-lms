import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
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
import { CreateQueryMessageDto } from './dto/create-query-message.dto';
import { QueryQueriesDto } from './dto/query-queries.dto';
import { QueryDetailDto, QuerySummaryDto } from './dto/query-response.dto';

/**
 * A tutor's query inbox, scoped to the courses they own: a thread on anyone
 * else's course is a 404, not a 403, so ids never leak. Replies hand the
 * thread back to the student; a tutor cannot resolve - that is the student's
 * call, so there is deliberately no resolve route here.
 */
@ApiTags('Tutors - Queries')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR)
@Controller('tutor/queries')
export class TutorQueriesController {
  constructor(
    private readonly queries: QueriesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Queries on my courses; the ones waiting on me come first' })
  @ApiPaginatedResponse(QuerySummaryDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryQueriesDto) {
    return this.queries.findAllForStaff(user.id, 'TUTOR', query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One query on my course, with the whole conversation' })
  @ApiOkResponse({ type: QueryDetailDto })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.findOneForStaff(user.id, 'TUTOR', id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Answer a query; it then waits on the student' })
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateQueryMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const thread = await this.queries.addStaffMessage(user.id, 'TUTOR', id, dto);
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
}
