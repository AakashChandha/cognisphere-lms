import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProfileModule } from './modules/profile/profile.module';
import { StudentsModule } from './modules/students/students.module';
import { TutorsModule } from './modules/tutors/tutors.module';
import { StorageModule } from './modules/storage/storage.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { CourseFilesModule } from './modules/course-files/course-files.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { QueriesModule } from './modules/queries/queries.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: config.throttle.ttlSeconds * 1000, limit: config.throttle.limit }],
      }),
    }),

    // Feature modules (Clean Architecture: controllers -> services -> Prisma)
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ProfileModule,
    StudentsModule,
    TutorsModule,
    StorageModule,
    CoursesModule,
    LessonsModule,
    CourseFilesModule,
    AssessmentsModule,
    QueriesModule,
    AnnouncementsModule,
    DashboardModule,
    AuditLogsModule,
  ],
  providers: [
    // Every route is authenticated by default (opt-out via `@Public()`),
    // then checked against `@Roles(...)` metadata when present.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
