import { ApiProperty } from '@nestjs/swagger';

export class FileViewedResponseDto {
  @ApiProperty({
    description:
      'True when this view was the last file the lesson needed; the server has already written the lesson completion.',
  })
  lessonCompleted: boolean;
}
