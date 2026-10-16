import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
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
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';
import { ReassignTutorDto } from './dto/reassign-tutor.dto';
import { DeactivateCourseDto } from './dto/deactivate-course.dto';
import { CoursesService } from './courses.service';

/**
 * Administrators can see inside every course (lessons, files, students),
 * hand a course to another tutor, e.g. after the original tutor leaves, and
 * deactivate/reactivate a course. Day-to-day editing goes through the
 * `tutor/*` routes, which a Master may call on any course.
 */
@ApiTags('Master - Courses')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/courses')
export class MasterCoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all courses across every tutor (Master only)' })
  @ApiPaginatedResponse(CourseResponseDto)
  findAll(@Query() query: QueryCourseDto) {
    return this.coursesService.findAllForMaster(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any course by id (Master only)' })
  findOne(@Param('id') id: string) {
    return this.coursesService.findOneForMaster(id);
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'List students enrolled in any course (Master only)' })
  listStudents(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.coursesService.listEnrolledStudentsForMaster(id, query);
  }

  @Patch(':id/tutor')
  @ApiOperation({ summary: 'Assign the course to another tutor (Master only)' })
  async reassignTutor(
    @Param('id') id: string,
    @Body() dto: ReassignTutorDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const course = await this.coursesService.reassignTutor(id, dto.tutorId);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.COURSE_TUTOR_CHANGED,
      entityType: 'Course',
      entityId: id,
      metadata: { tutorId: dto.tutorId },
      ipAddress: req.ip,
    });
    return { message: 'Course assigned to the new tutor', data: course };
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a course: hidden from students, read-only for its tutor (Master only)' })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const course = await this.coursesService.deactivate(id, dto.reason);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.COURSE_DEACTIVATED,
      entityType: 'Course',
      entityId: id,
      metadata: { reason: dto.reason },
      ipAddress: req.ip,
    });
    return { message: 'Course deactivated', data: course };
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a deactivated course as a draft (Master only)' })
  async reactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    const course = await this.coursesService.reactivate(id);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.COURSE_REACTIVATED,
      entityType: 'Course',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Course reactivated as a draft', data: course };
  }
}
