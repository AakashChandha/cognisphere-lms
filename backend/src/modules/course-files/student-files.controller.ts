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

@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student/files')
export class StudentFilesController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly localStorage: LocalStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List course materials across every enrolled course' })
  @ApiPaginatedResponse(CourseFileResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.filesService.findAllForStudent(user.id, query);
  }

  @Get(':id/stream-url')
  @ApiOperation({
    summary: 'Get a short-lived URL the browser can open directly (video playback, PDF preview)',
  })
  @ApiOkResponse({ type: FileStreamUrlDto })
  getStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.createStreamUrlForStudent(user.id, id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fetch a course material file with the Bearer token (used for PPTX preview and downloads)',
  })
  async download(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const file = await this.filesService.getForStudentDownload(user.id, id);
    const absolutePath = this.localStorage.resolveAbsolutePath(file.storageKey);

    // `inline` lets the browser PDF viewer (and our frontend blob preview)
    // render the file; the student UI still forces a save via `<a download>`
    // when the user clicks Download.
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    return res.sendFile(absolutePath);
  }
}
