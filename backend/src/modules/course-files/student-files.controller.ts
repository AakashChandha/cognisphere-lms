import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Get(':id')
  @ApiOperation({ summary: 'Download a course material file' })
  async download(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const file = await this.filesService.getForStudentDownload(user.id, id);
    res.download(this.localStorage.resolveAbsolutePath(file.storageKey), file.originalName);
  }
}
