import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CourseFilesService } from './course-files.service';
import { CourseFileResponseDto } from './dto/course-file-response.dto';

/**
 * Nested under `student/courses` so students can browse every material
 * uploaded to an enrolled course before downloading one via
 * `GET /student/files/:id`.
 */
@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student/courses')
export class StudentCourseFilesController {
  constructor(private readonly filesService: CourseFilesService) {}

  @Get(':courseId/files')
  @ApiOperation({ summary: 'List course materials for an enrolled course' })
  @ApiPaginatedResponse(CourseFileResponseDto)
  findAllForCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.filesService.findAllForCourseForStudent(user.id, courseId, query);
  }
}
