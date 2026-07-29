import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { CourseFilesService } from './course-files.service';
import { CourseFileResponseDto } from './dto/course-file-response.dto';

@ApiTags('Tutors')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR)
@Controller('tutor')
export class TutorFilesController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly auditLog: AuditLogService,
    private readonly localStorage: LocalStorageService,
  ) {}

  @Post('courses/:courseId/files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        lessonId: { type: 'string', nullable: true },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file to a course' })
  async upload(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const lessonId = (req.body as { lessonId?: string }).lessonId || undefined;

    const uploaded = await this.filesService.uploadForTutor(user.id, courseId, lessonId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.FILE_UPLOADED,
      entityType: 'CourseFile',
      entityId: uploaded.id,
      ipAddress: req.ip,
    });

    return { message: 'File uploaded successfully', data: uploaded };
  }

  @Get('files')
  @ApiOperation({ summary: "List files across the tutor's courses" })
  @ApiPaginatedResponse(CourseFileResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.filesService.findAllForTutor(user.id, query);
  }

  @Get('courses/:courseId/files')
  @ApiOperation({ summary: 'List files belonging to a single course owned by the tutor' })
  @ApiPaginatedResponse(CourseFileResponseDto)
  findAllForCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.filesService.findAllForCourseForTutor(user.id, courseId, query);
  }

  @Get('files/:id/stream')
  @ApiOperation({ summary: 'Download/stream a file owned by the tutor' })
  async stream(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const file = await this.filesService.getForTutorDownload(user.id, id);
    res.download(this.localStorage.resolveAbsolutePath(file.storageKey), file.originalName);
  }

  @Delete('files/:id')
  @ApiOperation({ summary: 'Delete a file' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.filesService.removeForTutor(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.FILE_DELETED,
      entityType: 'CourseFile',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'File deleted successfully', data: null };
  }
}
