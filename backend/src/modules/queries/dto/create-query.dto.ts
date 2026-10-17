import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** Trims incoming text so a whitespace-only field fails the length check. */
const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class CreateQueryDto {
  @ApiProperty({ format: 'uuid', description: 'A course the student is enrolled in' })
  @IsUUID()
  courseId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Optional lesson of that same course the question is about',
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string | null;

  @ApiProperty({ minLength: 3, maxLength: 200, example: 'What counts as a near miss?' })
  @trim
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiProperty({ minLength: 1, maxLength: 5000, description: 'The first message of the thread' })
  @trim
  @IsString()
  @Length(1, 5000)
  body: string;
}
