import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentController } from './student.controller';
import { MasterStudentsController } from './master-students.controller';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [ProfileModule],
  controllers: [StudentController, MasterStudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
