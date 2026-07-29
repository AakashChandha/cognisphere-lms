import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'master@cgslms.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(1)
  password: string;
}
