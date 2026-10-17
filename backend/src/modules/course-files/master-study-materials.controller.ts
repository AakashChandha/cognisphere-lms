import {
  BadRequestException,
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
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { CourseFilesService } from './course-files.service';
import { StudyMaterialResponseDto } from './dto/study-material-response.dto';
import { QueryStudyMaterialDto } from './dto/query-study-material.dto';
import { UploadStudyMaterialDto } from './dto/upload-study-material.dto';
import { UpdateStudyMaterialDto } from './dto/update-study-material.dto';
import { FileStreamUrlDto } from './dto/file-stream-url.dto';

/**
 * Same service as the tutor routes, mounted under `master/` so an
 * administrator's client never has to call a tutor path. Ownership checks
 * are bypassed for MASTER inside `CoursesService.assertTutorOwnsCourse`.
 */
@ApiTags('Master - Courses')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master')
export class MasterStudyMaterialsController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('study-materials')
  @ApiOperation({ summary: 'List study materials across every course (Master only)' })
  @ApiPaginatedResponse(StudyMaterialResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryStudyMaterialDto) {
    return this.filesService.findAllStudyMaterialsForStaff(user.id, query, 'MASTER');
  }

  @Post('courses/:courseId/study-materials')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a study material to any course (Master only)' })
  async upload(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadStudyMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    const material = await this.filesService.uploadStudyMaterial(
      user.id,
      courseId,
      dto,
      {
        tempPath: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      'MASTER',
    );

    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.STUDY_MATERIAL_UPLOADED,
      entityType: 'CourseFile',
      entityId: material.id,
      metadata: { courseId, title: material.title },
      ipAddress: req.ip,
    });

    return { message: 'Study material uploaded successfully', data: material };
  }

  @Patch('study-materials/:id')
  @ApiOperation({ summary: 'Edit any study material (Master only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudyMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const material = await this.filesService.updateStudyMaterial(user.id, id, dto, 'MASTER');
    return { message: 'Study material updated successfully', data: material };
  }

  @Delete('study-materials/:id')
  @ApiOperation({ summary: 'Delete any study material (Master only)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.filesService.removeStudyMaterial(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.STUDY_MATERIAL_DELETED,
      entityType: 'CourseFile',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Study material deleted successfully', data: null };
  }

  @Post('study-materials/:id/stream-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a short-lived URL to preview any study material (Master only)' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  getStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.createStudyMaterialStreamUrlForStaff(user.id, id);
  }
}
