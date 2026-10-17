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
 * Study materials are the reference library of a course (books, standards,
 * past papers) as opposed to the files attached to a lesson. A Master may
 * call these routes for any course; a tutor only for their own.
 */
@ApiTags('Tutors')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR, AppRole.MASTER)
@Controller('tutor')
export class TutorStudyMaterialsController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('study-materials')
  @ApiOperation({ summary: "List study materials across the tutor's courses" })
  @ApiPaginatedResponse(StudyMaterialResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryStudyMaterialDto) {
    return this.filesService.findAllStudyMaterialsForStaff(user.id, query);
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
  @ApiOperation({ summary: 'Upload a study material to a course (PDF, PPTX, MP4 video)' })
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

    const material = await this.filesService.uploadStudyMaterial(user.id, courseId, dto, {
      tempPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

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
  @ApiOperation({ summary: 'Rename a study material, edit its note, or move it to another course' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudyMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const material = await this.filesService.updateStudyMaterial(user.id, id, dto);
    return { message: 'Study material updated successfully', data: material };
  }

  @Delete('study-materials/:id')
  @ApiOperation({ summary: 'Delete a study material' })
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
  @ApiOperation({ summary: 'Get a short-lived URL to preview a study material' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  getStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.createStudyMaterialStreamUrlForStaff(user.id, id);
  }
}
