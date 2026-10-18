import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { TutorCoursesController } from './tutor-courses.controller';
import { StudentCoursesController } from './student-courses.controller';
import { MasterCoursesController } from './master-courses.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuditLogsModule, StorageModule],
  controllers: [TutorCoursesController, StudentCoursesController, MasterCoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
