import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  Req,
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
import type { Request } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { CourseFilesService } from './course-files.service';
import { CourseThumbnailResponseDto } from './dto/course-thumbnail-response.dto';

/**
 * Cover image upload. Lives in the course-files module because it reuses the
 * Multer/storage pipeline configured here; the course's `thumbnailUrl` may
 * still be set to an external link through `PATCH /tutor/courses/:id`.
 */
@ApiTags('Master - Courses')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/courses')
export class MasterCourseThumbnailController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post(':id/thumbnail')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a cover image for any course (JPEG/PNG/WebP, max 5 MB) (Master only)' })
  @ApiOkResponse({ type: CourseThumbnailResponseDto })
  async upload(
    @Param('id') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No image was uploaded');
    }

    const result = await this.filesService.uploadThumbnail(user.id, courseId, {
      tempPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.FILE_UPLOADED,
      entityType: 'Course',
      entityId: courseId,
      metadata: { purpose: 'COURSE_THUMBNAIL' },
      ipAddress: req.ip,
    });

    return { message: 'Cover image updated successfully', data: result };
  }

  @Delete(':id/thumbnail')
  @ApiOperation({ summary: 'Remove any course cover image (Master only)' })
  @ApiOkResponse({ type: CourseThumbnailResponseDto })
  async remove(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.filesService.removeThumbnail(user.id, courseId);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.FILE_DELETED,
      entityType: 'Course',
      entityId: courseId,
      metadata: { purpose: 'COURSE_THUMBNAIL' },
      ipAddress: req.ip,
    });
    return { message: 'Cover image removed', data: result };
  }
}
