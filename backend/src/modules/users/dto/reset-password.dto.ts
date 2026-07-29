import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8, example: 'NewStrongPass123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
