import { ApiProperty } from '@nestjs/swagger';
import { QueryStatus, RoleName } from '@prisma/client';

/** Who wrote a message, as the UI needs to label it. */
export type QueryMessageAuthorRole = Extract<RoleName, 'STUDENT' | 'TUTOR' | 'MASTER'>;

export class QueryMessageDto {
  @ApiProperty() id: string;
  @ApiProperty() body: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ description: 'User id of the author' }) authorId: string;
  @ApiProperty({ example: 'Samuel Student' }) authorName: string;
  @ApiProperty({
    enum: [RoleName.STUDENT, RoleName.TUTOR, RoleName.MASTER],
    description: "STUDENT when the author is the thread's student, else their highest staff role",
  })
  authorRole: QueryMessageAuthorRole;
  @ApiProperty({ description: 'The caller wrote this message' }) isMine: boolean;
}

export class QuerySummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: QueryStatus, description: 'Who the thread is waiting on' })
  status: QueryStatus;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ nullable: true }) lessonId: string | null;
  @ApiProperty({ nullable: true }) lessonTitle: string | null;
  @ApiProperty() studentId: string;
  @ApiProperty({ example: 'Samuel Student' }) studentName: string;
  @ApiProperty() messageCount: number;
  @ApiProperty() lastMessageAt: Date;
  @ApiProperty({ description: 'First 140 characters of the newest message, whitespace collapsed' })
  lastMessagePreview: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) resolvedAt: Date | null;
}

export class QueryDetailDto extends QuerySummaryDto {
  @ApiProperty({ type: [QueryMessageDto], description: 'Oldest first' })
  messages: QueryMessageDto[];
  @ApiProperty({ description: 'False once the thread is RESOLVED' }) canReply: boolean;
  @ApiProperty({ description: 'The student may close an unresolved thread; staff never can' })
  canResolve: boolean;
}
