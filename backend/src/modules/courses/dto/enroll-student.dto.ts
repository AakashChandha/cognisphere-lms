import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class EnrollStudentDto {
  @ApiProperty({ description: 'Student id (Student.id, not User.id)' })
  @IsUUID()
  studentId: string;
}
