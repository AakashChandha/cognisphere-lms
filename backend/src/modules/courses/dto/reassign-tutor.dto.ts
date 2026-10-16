import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReassignTutorDto {
  @ApiProperty({ description: 'Tutor id (Tutor.id, not User.id) who takes over the course' })
  @IsUUID()
  tutorId: string;
}
