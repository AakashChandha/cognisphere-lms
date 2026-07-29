import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';
import { CoursesService } from './courses.service';

@ApiTags('Master - Users')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/courses')
export class MasterCoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List all courses across every tutor (Master only)' })
  @ApiPaginatedResponse(CourseResponseDto)
  findAll(@Query() query: QueryCourseDto) {
    return this.coursesService.findAllForMaster(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any course by id (Master only)' })
  findOne(@Param('id') id: string) {
    return this.coursesService.findOneForMaster(id);
  }
}
