import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssessmentType, AttemptStatus } from '@prisma/client';

export class AttemptStudentDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() email: string;
}

export class AttemptGraderDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
}

export class AttemptAnswerOptionDto {
  @ApiProperty() id: string;
  @ApiProperty() text: string;
  @ApiPropertyOptional({ description: 'Hidden from a student until the attempt has been graded' })
  isCorrect?: boolean;
}

export class AttemptAnswerDto {
  @ApiProperty() questionId: string;
  @ApiProperty() prompt: string;
  @ApiProperty() points: number;
  @ApiProperty({ nullable: true }) chosenOptionId: string | null;
  @ApiProperty({ type: [AttemptAnswerOptionDto] }) options: AttemptAnswerOptionDto[];
}

export class AttemptSubmissionDto {
  @ApiProperty() id: string;
  @ApiProperty() originalName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() createdAt: Date;
}

export class AttemptSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() assessmentId: string;
  @ApiProperty() assessmentTitle: string;
  @ApiProperty({ enum: AssessmentType }) assessmentType: AssessmentType;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ type: AttemptStudentDto }) student: AttemptStudentDto;
  @ApiProperty() attemptNumber: number;
  @ApiProperty({ enum: AttemptStatus }) status: AttemptStatus;
  @ApiProperty({ nullable: true }) scorePercent: number | null;
  @ApiProperty() passPercent: number;
  @ApiProperty() startedAt: Date;
  @ApiProperty({ nullable: true }) submittedAt: Date | null;
  @ApiProperty({ nullable: true }) gradedAt: Date | null;
}

export class AttemptDetailDto extends AttemptSummaryDto {
  @ApiProperty({ nullable: true }) feedback: string | null;
  @ApiProperty({ type: AttemptGraderDto, nullable: true }) gradedBy: AttemptGraderDto | null;
  @ApiProperty({ type: [AttemptAnswerDto], description: 'Empty for DOCUMENT assessments' })
  answers: AttemptAnswerDto[];
  @ApiProperty({ type: [AttemptSubmissionDto], description: 'Empty for MCQ assessments' })
  submissions: AttemptSubmissionDto[];
}
