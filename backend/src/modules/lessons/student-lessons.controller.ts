import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { LessonsService } from './lessons.service';

@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student/lessons')
export class StudentLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'View a lesson from an enrolled course' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lessonsService.findForStudent(user.id, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a lesson as completed' })
  async complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lessonsService.setCompletedForStudent(user.id, id, true);
    return { message: 'Lesson marked as complete', data: null };
  }

  @Delete(':id/complete')
  @ApiOperation({ summary: 'Un-mark a lesson as completed' })
  async uncomplete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lessonsService.setCompletedForStudent(user.id, id, false);
    return { message: 'Lesson marked as not complete', data: null };
  }
}
