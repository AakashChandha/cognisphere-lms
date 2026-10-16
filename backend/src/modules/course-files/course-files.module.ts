import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AppConfigService } from '../../config/app-config.service';
import { CourseFilesService } from './course-files.service';
import { TutorFilesController } from './tutor-files.controller';
import { StudentFilesController } from './student-files.controller';
import { StudentCourseFilesController } from './student-course-files.controller';
import { FileStreamController } from './file-stream.controller';
import { MasterFilesController } from './master-files.controller';
import { CoursesModule } from '../courses/courses.module';
import { StorageModule } from '../storage/storage.module';
import { LocalStorageService } from '../storage/local-storage.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    CoursesModule,
    StorageModule,
    AuditLogsModule,
    // Signs the short-lived stream tokens; secret is chosen per call.
    JwtModule.register({}),
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
  ],
  providers: [CourseFilesService],
  exports: [CourseFilesService],
})
export class CourseFilesModule {}
