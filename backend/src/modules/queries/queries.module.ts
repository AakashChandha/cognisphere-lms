import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueriesService } from './queries.service';
import { StudentQueriesController } from './student-queries.controller';
import { TutorQueriesController } from './tutor-queries.controller';
import { MasterQueriesController } from './master-queries.controller';

/**
 * Student <-> tutor Q&A threads on a course. One service holds the visibility
 * and state rules; the three controllers are role-scoped wrappers over it.
 */
@Module({
  imports: [AuditLogsModule],
  controllers: [StudentQueriesController, TutorQueriesController, MasterQueriesController],
  providers: [QueriesService],
  exports: [QueriesService],
})
export class QueriesModule {}
