import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { LessonsService } from './lessons.service';

/**
 * Nested under `student/courses` (rather than `student/lessons`) so students
 * can list every lesson of an enrolled course before drilling into one via
 * `GET /student/lessons/:id`.
 */
@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student/courses')
export class StudentCourseLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':courseId/lessons')
  @ApiOperation({ summary: "List an enrolled course's lessons, ordered by position" })
  findAllForCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lessonsService.findAllForCourseForStudent(user.id, courseId);
  }
}
