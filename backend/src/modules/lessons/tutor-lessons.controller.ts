import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@ApiTags('Tutors')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR)
@Controller('tutor')
export class TutorLessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('courses/:courseId/lessons')
  @ApiOperation({ summary: "List a course's lessons, ordered by position" })
  findAllForCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lessonsService.findAllForCourseForTutor(user.id, courseId);
  }

  @Post('courses/:courseId/lessons')
  @ApiOperation({ summary: 'Create a lesson within a course' })
  async create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const lesson = await this.lessonsService.createForTutor(user.id, courseId, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.LESSON_CREATED,
      entityType: 'Lesson',
      entityId: lesson.id,
      ipAddress: req.ip,
    });
    return { message: 'Lesson created successfully', data: lesson };
  }

  @Put('lessons/:id')
  @ApiOperation({ summary: 'Update a lesson' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const lesson = await this.lessonsService.updateForTutor(user.id, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.LESSON_UPDATED,
      entityType: 'Lesson',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Lesson updated successfully', data: lesson };
  }

  @Delete('lessons/:id')
  @ApiOperation({ summary: 'Delete a lesson' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.lessonsService.removeForTutor(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.LESSON_DELETED,
      entityType: 'Lesson',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Lesson deleted successfully', data: null };
  }
}
