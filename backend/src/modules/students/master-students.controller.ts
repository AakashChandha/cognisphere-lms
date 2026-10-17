import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StudentsService } from './students.service';
import { StudentResponseDto } from './dto/student-response.dto';
import { StudentProgressDetailDto } from './dto/student-progress.dto';

@ApiTags('Master - Users')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/students')
export class MasterStudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all students (Master only)' })
  @ApiPaginatedResponse(StudentResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.studentsService.findAllPaginated(query);
  }

  @Get(':studentId')
  @ApiOperation({ summary: 'How far one student has got, across every course (Master only)' })
  getStudentProgress(
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<StudentProgressDetailDto> {
    // `null` tutor scope: the master view spans all courses.
    return this.studentsService.getProgressDetail(studentId, null);
  }
}
