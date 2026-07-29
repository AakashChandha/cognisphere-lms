import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { StudentsService } from './students.service';
import { StudentDashboardDto } from './dto/student-dashboard.dto';
import { ProfileService } from '../profile/profile.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student')
export class StudentController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly profileService: ProfileService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get the student dashboard summary' })
  getDashboard(@CurrentUser() user: AuthenticatedUser): Promise<StudentDashboardDto> {
    return this.studentsService.getDashboard(user.id);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the current student profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update the current student profile' })
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.profileService.updateProfile(user.id, dto);
    return { message: 'Profile updated successfully', data: profile };
  }
}
