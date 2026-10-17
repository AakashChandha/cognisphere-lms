import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AppConfigService } from '../../config/app-config.service';
import { CoursesModule } from '../courses/courses.module';
import { StorageModule } from '../storage/storage.module';
import { LocalStorageService } from '../storage/local-storage.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AssessmentsService } from './assessments.service';
import { TutorAssessmentsController } from './tutor-assessments.controller';
import { MasterAssessmentsController } from './master-assessments.controller';
import { StudentAssessmentsController } from './student-assessments.controller';

@Module({
  imports: [
    CoursesModule,
    StorageModule,
    AuditLogsModule,
    // Signs the same short-lived stream tokens the course-files module does,
    // so question papers and submissions are read through `/api/files/stream`.
    // Question papers and submissions are streamed straight to disk inside
    // the storage volume, exactly like course material.
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
    TutorAssessmentsController,
    MasterAssessmentsController,
    StudentAssessmentsController,
  ],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
