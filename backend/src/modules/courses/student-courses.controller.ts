import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';
import { CoursesService } from './courses.service';

@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student/courses')
export class StudentCoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List courses the current student is enrolled in' })
  @ApiPaginatedResponse(CourseResponseDto)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryCourseDto) {
    return this.coursesService.findEnrolledForStudent(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of an enrolled course' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findOneForStudent(user.id, id);
  }
}
