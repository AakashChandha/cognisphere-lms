import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TutorsService } from './tutors.service';
import { TutorDashboardDto } from './dto/tutor-dashboard.dto';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { StudentProgressDetailDto } from '../students/dto/student-progress.dto';
import { StudentsService } from '../students/students.service';
import { ProfileService } from '../profile/profile.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

@ApiTags('Tutors')
@ApiBearerAuth('access-token')
@Roles(AppRole.TUTOR)
@Controller('tutor')
export class TutorController {
  constructor(
    private readonly tutorsService: TutorsService,
    private readonly profileService: ProfileService,
    private readonly studentsService: StudentsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get the tutor dashboard summary' })
  getDashboard(@CurrentUser() user: AuthenticatedUser): Promise<TutorDashboardDto> {
    return this.tutorsService.getDashboard(user.id);
  }

  @Get('students')
  @ApiOperation({ summary: "List students enrolled across the tutor's courses" })
  @ApiPaginatedResponse(StudentResponseDto)
  listStudents(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.tutorsService.listStudentsForTutor(user.id, query);
  }

  @Get('students/directory')
  @Roles(AppRole.TUTOR, AppRole.MASTER)
  @ApiOperation({
    summary: 'List every student in the system, for selecting who to enroll into a course',
  })
  @ApiPaginatedResponse(StudentResponseDto)
  listStudentDirectory(@Query() query: PaginationQueryDto) {
    return this.studentsService.findAllPaginated(query);
  }

  // Declared after `students/directory`, or this wildcard would swallow it.
  @Get('students/:studentId')
  @ApiOperation({ summary: "How far one student has got in the tutor's own courses" })
  getStudentProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<StudentProgressDetailDto> {
    return this.tutorsService.getStudentProgressDetail(user.id, studentId);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the current tutor profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update the current tutor profile' })
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.profileService.updateProfile(user.id, dto);
    return { message: 'Profile updated successfully', data: profile };
  }
}
