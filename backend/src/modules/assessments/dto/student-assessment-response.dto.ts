import { ApiProperty } from '@nestjs/swagger';
import { AssessmentType, AttemptStatus } from '@prisma/client';
import { AssessmentFileDto, AssessmentQuestionDto } from './assessment-response.dto';

export type StudentAssessmentStatus = 'NOT_STARTED' | AttemptStatus;

export class StudentAssessmentSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ enum: AssessmentType }) type: AssessmentType;
  @ApiProperty() title: string;
  @ApiProperty() instructions: string;
  @ApiProperty() passPercent: number;
  @ApiProperty({ nullable: true }) timeLimitMinutes: number | null;
  @ApiProperty() questionCount: number;
  @ApiProperty({ description: "NOT_STARTED until the student's first attempt" })
  myStatus: StudentAssessmentStatus;
  @ApiProperty({ nullable: true, description: 'Best score across every attempt' })
  bestScorePercent: number | null;
  @ApiProperty() attemptsCount: number;
  @ApiProperty({ nullable: true }) latestAttemptId: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Attempt holding bestScorePercent, so "view result" never shows a worse run',
  })
  bestAttemptId: string | null;
}

export class StudentAssessmentDetailDto extends StudentAssessmentSummaryDto {
  @ApiProperty({ type: [AssessmentQuestionDto], description: 'Options never carry isCorrect' })
  questions: AssessmentQuestionDto[];
  @ApiProperty({ type: AssessmentFileDto, nullable: true }) questionPaper: AssessmentFileDto | null;
  @ApiProperty({ nullable: true, description: 'The attempt still IN_PROGRESS, if any' })
  activeAttemptId: string | null;
}
