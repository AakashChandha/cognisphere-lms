import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

@ApiTags('Master - Users')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/profile')
export class MasterProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get the master administrator profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update the master administrator profile' })
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.profileService.updateProfile(user.id, dto);
    return { message: 'Profile updated successfully', data: profile };
  }
}
