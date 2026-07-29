import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { MasterProfileController } from './master-profile.controller';

@Module({
  controllers: [MasterProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
