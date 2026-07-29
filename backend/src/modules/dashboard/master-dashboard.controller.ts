import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { MasterDashboardService } from './master-dashboard.service';
import { MasterDashboardDto } from './dto/master-dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master')
export class MasterDashboardController {
  constructor(private readonly dashboardService: MasterDashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get system-wide statistics for the Master dashboard' })
  getDashboard(): Promise<MasterDashboardDto> {
    return this.dashboardService.getDashboard();
  }
}
