import { ApiProperty } from '@nestjs/swagger';

export class LessonResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() title: string;
  @ApiProperty() content: string;
  @ApiProperty() orderIndex: number;
  @ApiProperty() filesCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
