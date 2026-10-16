import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';

@ApiTags('Tutors')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR, AppRole.MASTER)
@Controller('tutor/courses')
export class TutorCoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new draft course' })
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const course = await this.coursesService.createForTutor(user.id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.COURSE_CREATED,
      entityType: 'Course',
      entityId: course.id,
      ipAddress: req.ip,
    });
    return { message: 'Course created successfully', data: course };
  }

  @Get()
  @ApiOperation({ summary: "List the current tutor's courses" })
  @ApiPaginatedResponse(CourseResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryCourseDto) {
    return this.coursesService.findAllForTutor(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a course owned by the current tutor' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findOneForTutor(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a course owned by the current tutor' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const course = await this.coursesService.updateForTutor(user.id, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.COURSE_UPDATED,
      entityType: 'Course',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Course updated successfully', data: course };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a course owned by the current tutor' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.coursesService.removeForTutor(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.COURSE_DELETED,
      entityType: 'Course',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Course deleted successfully', data: null };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft course so students can view it' })
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const course = await this.coursesService.publish(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.COURSE_PUBLISHED,
      entityType: 'Course',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Course published successfully', data: course };
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return a published course to draft' })
  async unpublish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const course = await this.coursesService.unpublish(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.COURSE_UPDATED,
      entityType: 'Course',
      entityId: id,
      metadata: { unpublished: true },
      ipAddress: req.ip,
    });
    return { message: 'Course moved back to draft', data: course };
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a course' })
  async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const course = await this.coursesService.archive(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.COURSE_ARCHIVED,
      entityType: 'Course',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Course archived successfully', data: course };
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'List students enrolled in this course' })
  listStudents(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.coursesService.listEnrolledStudents(user.id, id, query);
  }

  @Post(':id/students')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enroll a student into this course' })
  async enroll(
    @Param('id') id: string,
    @Body() dto: EnrollStudentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.coursesService.enrollStudent(user.id, id, dto.studentId);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ENROLLMENT_CREATED,
      entityType: 'Course',
      entityId: id,
      metadata: { studentId: dto.studentId },
      ipAddress: req.ip,
    });
    return { message: 'Student enrolled successfully', data: null };
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Remove a student from this course' })
  async unenroll(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.coursesService.unenrollStudent(user.id, id, studentId);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ENROLLMENT_REMOVED,
      entityType: 'Course',
      entityId: id,
      metadata: { studentId },
      ipAddress: req.ip,
    });
    return { message: 'Student removed from course successfully', data: null };
  }
}
