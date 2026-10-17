import { ApiProperty } from '@nestjs/swagger';

export class CourseThumbnailResponseDto {
  @ApiProperty({
    nullable: true,
    description: 'Same-origin, unsigned URL of the cover image; null once it is removed',
    example: '/api/files/thumbnail/3f1c0b6e-0f2d-4a5e-9f1b-7a2c8d9e0f11',
  })
  thumbnailUrl: string | null;
}
