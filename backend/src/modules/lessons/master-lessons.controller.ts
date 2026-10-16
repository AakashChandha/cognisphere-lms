import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { LessonsService } from './lessons.service';

@ApiTags('Master - Courses')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/courses')
export class MasterLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':courseId/lessons')
  @ApiOperation({ summary: "List any course's lessons (Master only)" })
  findAllForCourse(@Param('courseId') courseId: string) {
    return this.lessonsService.findAllForCourse(courseId);
  }
}
