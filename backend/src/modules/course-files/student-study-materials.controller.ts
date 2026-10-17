import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CourseFilesService } from './course-files.service';
import { StudyMaterialResponseDto } from './dto/study-material-response.dto';
import { QueryStudyMaterialDto } from './dto/query-study-material.dto';
import { FileStreamUrlDto } from './dto/file-stream-url.dto';

/**
 * The student Materials tab. Lists only the study materials of courses the
 * student is enrolled in; viewing still goes through a signed stream URL,
 * so nothing is downloadable.
 */
@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student')
export class StudentStudyMaterialsController {
  constructor(private readonly filesService: CourseFilesService) {}

  @Get('study-materials')
  @ApiOperation({ summary: 'List the study materials of every enrolled course' })
  @ApiPaginatedResponse(StudyMaterialResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryStudyMaterialDto) {
    return this.filesService.findAllStudyMaterialsForStudent(user.id, query);
  }

  @Post('study-materials/:id/stream-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a short-lived URL to read a study material in the browser' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  getStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.createStudyMaterialStreamUrlForStudent(user.id, id);
  }
}
