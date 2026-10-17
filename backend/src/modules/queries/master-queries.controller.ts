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
 * The Master twin of `tutor-queries.controller.ts`: the same routes under
 * `/master`, on the same service, with the course-ownership scope dropped so
 * an admin sees and answers every query. Masters do not resolve either.
 */
@ApiTags('Master - Queries')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/queries')
export class MasterQueriesController {
  constructor(
    private readonly queries: QueriesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Every query in the platform; the ones waiting on staff come first' })
  @ApiPaginatedResponse(QuerySummaryDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryQueriesDto) {
    return this.queries.findAllForStaff(user.id, 'MASTER', query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One query, with the whole conversation' })
  @ApiOkResponse({ type: QueryDetailDto })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queries.findOneForStaff(user.id, 'MASTER', id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Answer any query; it then waits on the student' })
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateQueryMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const thread = await this.queries.addStaffMessage(user.id, 'MASTER', id, dto);
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
