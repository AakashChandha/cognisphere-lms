import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadStudyMaterialDto {
  @ApiProperty({
    example: 'NEBOSH IG1 Element 1 - Why we should manage workplace health and safety',
    maxLength: 200,
    description: 'Display name of the resource; what the student sees in the Materials tab.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
