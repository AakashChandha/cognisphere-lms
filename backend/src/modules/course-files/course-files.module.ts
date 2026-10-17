import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AppConfigService } from '../../config/app-config.service';
import { CourseFilesService } from './course-files.service';
import { TutorFilesController } from './tutor-files.controller';
import { StudentFilesController } from './student-files.controller';
import { StudentCourseFilesController } from './student-course-files.controller';
import { FileStreamController } from './file-stream.controller';
import { MasterFilesController } from './master-files.controller';
import { TutorStudyMaterialsController } from './tutor-study-materials.controller';
import { MasterStudyMaterialsController } from './master-study-materials.controller';
import { StudentStudyMaterialsController } from './student-study-materials.controller';
import { TutorCourseThumbnailController } from './tutor-course-thumbnail.controller';
import { MasterCourseThumbnailController } from './master-course-thumbnail.controller';
import { CoursesModule } from '../courses/courses.module';
import { LessonsModule } from '../lessons/lessons.module';
import { StorageModule } from '../storage/storage.module';
import { LocalStorageService } from '../storage/local-storage.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    CoursesModule,
    // Recording a FileView can complete a lesson, which LessonsService owns.
    LessonsModule,
    StorageModule,
    AuditLogsModule,
    // Multer streams every upload straight to disk inside the storage volume
    // and rejects anything over the configured size before it is fully
    // received, so large course videos never sit in memory.
    MulterModule.registerAsync({
      imports: [StorageModule],
      inject: [AppConfigService, LocalStorageService],
      useFactory: (config: AppConfigService, localStorage: LocalStorageService) => ({
        storage: diskStorage({ destination: localStorage.tempDir }),
        limits: { fileSize: config.storage.maxFileSizeBytes, files: 1 },
      }),
    }),
  ],
  controllers: [
    TutorFilesController,
    StudentFilesController,
    StudentCourseFilesController,
    FileStreamController,
    MasterFilesController,
    TutorStudyMaterialsController,
    MasterStudyMaterialsController,
    StudentStudyMaterialsController,
    TutorCourseThumbnailController,
    MasterCourseThumbnailController,
  ],
  providers: [CourseFilesService],
  exports: [CourseFilesService],
})
export class CourseFilesModule {}
