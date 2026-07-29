import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { TutorLessonsController } from './tutor-lessons.controller';
import { StudentLessonsController } from './student-lessons.controller';
import { StudentCourseLessonsController } from './student-course-lessons.controller';
import { CoursesModule } from '../courses/courses.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [CoursesModule, AuditLogsModule],
  controllers: [TutorLessonsController, StudentLessonsController, StudentCourseLessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
