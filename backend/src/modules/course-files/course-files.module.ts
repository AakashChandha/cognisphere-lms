import { Module } from '@nestjs/common';
import { CourseFilesService } from './course-files.service';
import { TutorFilesController } from './tutor-files.controller';
import { StudentFilesController } from './student-files.controller';
import { StudentCourseFilesController } from './student-course-files.controller';
import { CoursesModule } from '../courses/courses.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [CoursesModule, StorageModule, AuditLogsModule],
  controllers: [TutorFilesController, StudentFilesController, StudentCourseFilesController],
  providers: [CourseFilesService],
  exports: [CourseFilesService],
})
export class CourseFilesModule {}
