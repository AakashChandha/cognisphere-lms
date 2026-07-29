import { Module } from '@nestjs/common';
import { MasterDashboardService } from './master-dashboard.service';
import { MasterDashboardController } from './master-dashboard.controller';

@Module({
  controllers: [MasterDashboardController],
  providers: [MasterDashboardService],
})
export class DashboardModule {}
