import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocalStorageService } from '../storage/local-storage.service';
import { CourseFilesService } from './course-files.service';
import { CourseFileResponseDto } from './dto/course-file-response.dto';
import { FileStreamUrlDto } from './dto/file-stream-url.dto';

/** Administrators can inspect every course's material. */
@ApiTags('Master - Courses')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master')
export class MasterFilesController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly localStorage: LocalStorageService,
  ) {}

  @Get('courses/:courseId/files')
  @ApiOperation({ summary: "List any course's files (Master only)" })
  @ApiPaginatedResponse(CourseFileResponseDto)
  findAllForCourse(@Param('courseId') courseId: string, @Query() query: PaginationQueryDto) {
    return this.filesService.findAllForCourseForMaster(courseId, query);
  }

  @Get('files/:id/stream-url')
  @ApiOperation({ summary: 'Get a short-lived URL to preview any file (Master only)' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  getStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.createStreamUrlForMaster(user.id, id);
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Fetch any file with the Bearer token (PPTX preview) (Master only)' })
  async fetch(@Param('id') id: string, @Res() res: Response) {
    const file = await this.filesService.getForMaster(id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    return res.sendFile(this.localStorage.resolveAbsolutePath(file.storageKey));
  }
}
