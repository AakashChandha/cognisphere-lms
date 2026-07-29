import { Module } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { TutorController } from './tutor.controller';
import { MasterTutorsController } from './master-tutors.controller';
import { ProfileModule } from '../profile/profile.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [ProfileModule, StudentsModule],
  controllers: [TutorController, MasterTutorsController],
  providers: [TutorsService],
  exports: [TutorsService],
})
export class TutorsModule {}
