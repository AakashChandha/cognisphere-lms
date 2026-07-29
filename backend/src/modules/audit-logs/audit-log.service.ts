import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordAuditEventInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Central place every module writes audit trail entries through. Keeping a
 * single `record()` entry point avoids duplicating audit-log persistence
 * logic across Auth, Users, Courses, etc. (DRY).
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (error) {
      // Auditing must never break the primary business operation.
      this.logger.error('Failed to write audit log entry', error as Error);
    }
  }
}
