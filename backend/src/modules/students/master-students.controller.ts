import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StudentsService } from './students.service';
import { StudentResponseDto } from './dto/student-response.dto';

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
}
