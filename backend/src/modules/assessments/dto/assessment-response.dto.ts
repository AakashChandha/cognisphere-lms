import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssessmentStatus, AssessmentType } from '@prisma/client';

export class AssessmentOptionDto {
  @ApiProperty() id: string;
  @ApiProperty() text: string;
  @ApiProperty() orderIndex: number;
  @ApiPropertyOptional({
    description: 'The answer key. Present for tutors and masters only, never for students.',
  })
  isCorrect?: boolean;
}

export class AssessmentQuestionDto {
  @ApiProperty() id: string;
  @ApiProperty() prompt: string;
  @ApiProperty() points: number;
  @ApiProperty() orderIndex: number;
  @ApiProperty({ type: [AssessmentOptionDto] }) options: AssessmentOptionDto[];
}

export class AssessmentFileDto {
  @ApiProperty() id: string;
  @ApiProperty() originalName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
}

export class AssessmentSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ enum: AssessmentType }) type: AssessmentType;
  @ApiProperty() title: string;
  @ApiProperty() instructions: string;
  @ApiProperty() passPercent: number;
  @ApiProperty({ nullable: true }) timeLimitMinutes: number | null;
  @ApiProperty({ enum: AssessmentStatus }) status: AssessmentStatus;
  @ApiProperty() orderIndex: number;
  @ApiProperty({ description: 'MCQ only' }) questionCount: number;
  @ApiProperty({ description: 'DOCUMENT only' }) hasQuestionPaper: boolean;
  @ApiProperty({ description: 'Every attempt by every student' }) attemptCount: number;
  @ApiProperty({ description: 'Attempts sitting in SUBMITTED, waiting for a tutor' })
  awaitingReviewCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class AssessmentDetailDto extends AssessmentSummaryDto {
  @ApiProperty({ type: [AssessmentQuestionDto] }) questions: AssessmentQuestionDto[];
  @ApiProperty({ type: AssessmentFileDto, nullable: true }) questionPaper: AssessmentFileDto | null;
}
