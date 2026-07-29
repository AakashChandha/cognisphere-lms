import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'Setting up your development environment' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'In this lesson we install Node.js, VS Code and Git...' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({ description: 'Position within the course, defaults to next available' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
