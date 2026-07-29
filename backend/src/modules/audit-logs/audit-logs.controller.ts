import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';

@ApiTags('Master - Audit Logs')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/auditlogs')
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List system audit logs (Master only)' })
  @ApiPaginatedResponse(AuditLogResponseDto)
  async findAll(@Query() query: QueryAuditLogDto): Promise<PaginatedResult<AuditLogResponseDto>> {
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };

    const [logs, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorName: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));

    return buildPaginatedResult(items, totalItems, query.page, query.pageSize);
  }
}
