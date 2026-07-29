import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { AppRole } from '../../../common/constants/roles.constant';

export class CreateUserDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ enum: AppRole, isArray: true, example: [AppRole.STUDENT] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AppRole, { each: true })
  roles: AppRole[];
}
