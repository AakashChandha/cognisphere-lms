import { ApiProperty } from '@nestjs/swagger';
import { AssessmentType, CourseProgressionMode } from '@prisma/client';
import { StudentAssessmentStatus } from '../../assessments/dto/student-assessment-response.dto';

/**
 * How one student is doing on one assessment, from the staff side. The
 * standing (`status`, `bestScorePercent`, `latestAttemptId`) is exactly what
 * the student themselves is shown by
 * `AssessmentsService.toStudentSummaryDto` — unlimited retries, the best
 * score counts, a pass is final.
 */
export class StudentProgressCourseAssessmentDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: AssessmentType }) type: AssessmentType;
  @ApiProperty({ description: "NOT_STARTED until the student's first attempt" })
  status: StudentAssessmentStatus;
  @ApiProperty() passPercent: number;
  @ApiProperty({ nullable: true, description: 'Best score across every attempt' })
  bestScorePercent: number | null;
  @ApiProperty() attemptsCount: number;
  @ApiProperty({ nullable: true }) latestAttemptId: string | null;
}

export class StudentProgressCourseLessonDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() orderIndex: number;
  @ApiProperty() isCompleted: boolean;
  @ApiProperty({ nullable: true }) completedAt: Date | null;
}

export class StudentProgressCourseDto {
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty({ enum: CourseProgressionMode }) progressionMode: CourseProgressionMode;
  @ApiProperty() enrolledAt: Date;
  @ApiProperty() completedLessons: number;
  @ApiProperty() totalLessons: number;
  @ApiProperty({ description: '0..100, rounded; 0 when the course has no lessons' })
  percent: number;
  @ApiProperty({ nullable: true, description: 'First incomplete lesson, in course order' })
  nextLessonId: string | null;
  @ApiProperty({ nullable: true }) nextLessonTitle: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Newest of this student lesson completions and assessment attempt updates',
  })
  lastActivityAt: Date | null;
  @ApiProperty({ type: [StudentProgressCourseLessonDto] })
  lessons: StudentProgressCourseLessonDto[];
  @ApiProperty({ type: [StudentProgressCourseAssessmentDto], description: 'Published assessments only' })
  assessments: StudentProgressCourseAssessmentDto[];
}

export class StudentProgressStudentDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
}

export class StudentProgressTotalsDto {
  @ApiProperty() coursesCount: number;
  @ApiProperty({ description: 'Courses where every lesson is done (and there is at least one)' })
  completedCoursesCount: number;
  @ApiProperty() lessonsCompleted: number;
  @ApiProperty() lessonsTotal: number;
  @ApiProperty({ description: '0..100, rounded; 0 when there are no lessons at all' })
  overallPercent: number;
  @ApiProperty() assessmentsPassed: number;
  @ApiProperty() assessmentsTotal: number;
}

export class StudentProgressDetailDto {
  @ApiProperty({ type: StudentProgressStudentDto }) student: StudentProgressStudentDto;
  @ApiProperty({ type: StudentProgressTotalsDto }) totals: StudentProgressTotalsDto;
  @ApiProperty({ type: [StudentProgressCourseDto], description: 'Ordered by enrolledAt desc' })
  courses: StudentProgressCourseDto[];
}
