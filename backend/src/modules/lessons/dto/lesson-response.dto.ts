import { ApiProperty } from '@nestjs/swagger';

/** A lesson attachment as the student sees it, including their view state. */
export class LessonFileDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ nullable: true }) lessonId: string | null;
  @ApiProperty() originalName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() downloadUrl: string;
  @ApiProperty({
    description: 'GET this to obtain a short-lived URL the browser can open directly',
  })
  streamUrlEndpoint: string;
  @ApiProperty({ description: 'True once the student has reached the end of this file' })
  isViewed: boolean;
  @ApiProperty() createdAt: Date;
}

export class LessonResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() title: string;
  @ApiProperty() content: string;
  @ApiProperty() orderIndex: number;
  @ApiProperty() filesCount: number;
  @ApiProperty({ required: false, description: 'Only for students: whether this lesson is complete' })
  completed?: boolean;
  @ApiProperty({
    required: false,
    description: 'Only for students: whether this lesson is complete (same as `completed`)',
  })
  isCompleted?: boolean;
  @ApiProperty({
    required: false,
    description:
      'Only for students. True in a SEQUENTIAL course while an earlier lesson is incomplete; always false in a FREE course.',
  })
  isLocked?: boolean;
  @ApiProperty({
    type: [LessonFileDto],
    required: false,
    description: "Only for students: the lesson's files with their view state",
  })
  files?: LessonFileDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
