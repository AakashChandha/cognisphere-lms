import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';

/**
 * CRUD for announcements. Readable by every authenticated role (filtered by
 * relevance); creation/update/deletion is restricted to Tutors (their own
 * courses) and Master (any announcement).
 */
@ApiTags('Announcements')
@ApiBearerAuth('access-token')
@Controller('announcements')
export class AnnouncementsController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List announcements relevant to the current user' })
  @ApiPaginatedResponse(AnnouncementResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.announcementsService.findAllForUser(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single announcement' })
  findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Post()
  @Roles(AppRole.TUTOR, AppRole.MASTER)
  @ApiOperation({ summary: 'Create an announcement (Tutor or Master)' })
  async create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const announcement = await this.announcementsService.create(user, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ANNOUNCEMENT_CREATED,
      entityType: 'Announcement',
      entityId: announcement.id,
      ipAddress: req.ip,
    });
    return { message: 'Announcement created successfully', data: announcement };
  }

  @Patch(':id')
  @Roles(AppRole.TUTOR, AppRole.MASTER)
  @ApiOperation({ summary: 'Update an announcement (author or Master)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const announcement = await this.announcementsService.update(user, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ANNOUNCEMENT_UPDATED,
      entityType: 'Announcement',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Announcement updated successfully', data: announcement };
  }

  @Delete(':id')
  @Roles(AppRole.TUTOR, AppRole.MASTER)
  @ApiOperation({ summary: 'Delete an announcement (author or Master)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.announcementsService.remove(user, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ANNOUNCEMENT_DELETED,
      entityType: 'Announcement',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Announcement deleted successfully', data: null };
  }
}
