import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) actorId: string | null;
  @ApiProperty({ nullable: true }) actorName: string | null;
  @ApiProperty({ enum: AuditAction }) action: AuditAction;
  @ApiProperty() entityType: string;
  @ApiProperty({ nullable: true }) entityId: string | null;
  @ApiProperty({ nullable: true, type: Object }) metadata: Record<string, unknown> | null;
  @ApiProperty({ nullable: true }) ipAddress: string | null;
  @ApiProperty() createdAt: Date;
}
