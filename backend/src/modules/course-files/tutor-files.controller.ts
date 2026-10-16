import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
import { FileStreamUrlDto } from './dto/file-stream-url.dto';
import { UpdateCourseFileDto } from './dto/update-course-file.dto';

@ApiTags('Tutors')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR, AppRole.MASTER)
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
  // Storage/limits come from `MulterModule.registerAsync` in the module:
  // the file is streamed to disk and rejected with 413 if it exceeds
  // MAX_FILE_SIZE_BYTES.
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file to a course (PDF, PPTX, MP4 video, …)' })
  async upload(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const lessonId = (req.body as { lessonId?: string }).lessonId || undefined;

    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    const uploaded = await this.filesService.uploadForTutor(user.id, courseId, lessonId, {
      tempPath: file.path,
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

  @Get('files/:id/stream-url')
  @ApiOperation({ summary: 'Get a short-lived URL to play/preview a file owned by the tutor' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  getStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.createStreamUrlForTutor(user.id, id);
  }

  @Get('files/:id/stream')
  @ApiOperation({ summary: 'Download a file owned by the tutor (attachment)' })
  async stream(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const file = await this.filesService.getForTutorDownload(user.id, id);
    res.download(this.localStorage.resolveAbsolutePath(file.storageKey), file.originalName);
  }

  @Patch('files/:id')
  @ApiOperation({ summary: 'Attach a file to a lesson, or detach it (lessonId: null)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await this.filesService.setLessonForTutor(user.id, id, dto.lessonId ?? null);
    return { message: 'File updated successfully', data: file };
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
