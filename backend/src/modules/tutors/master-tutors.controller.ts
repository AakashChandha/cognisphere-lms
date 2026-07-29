import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TutorsService } from './tutors.service';
import { TutorResponseDto } from './dto/tutor-response.dto';

@ApiTags('Master - Users')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/tutors')
export class MasterTutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tutors (Master only)' })
  @ApiPaginatedResponse(TutorResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.tutorsService.findAllPaginated(query);
  }
}
