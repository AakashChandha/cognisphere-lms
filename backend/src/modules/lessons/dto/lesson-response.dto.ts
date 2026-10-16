import { ApiProperty } from '@nestjs/swagger';

export class LessonResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() title: string;
  @ApiProperty() content: string;
  @ApiProperty() orderIndex: number;
  @ApiProperty() filesCount: number;
  @ApiProperty({ required: false, description: 'Only for students: whether they marked this lesson complete' })
  completed?: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
