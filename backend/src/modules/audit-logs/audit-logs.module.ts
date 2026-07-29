import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
