import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
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

  /** Exactly one role: a person is a master, a tutor or a student, never a mix. */
  @ApiProperty({ enum: AppRole, isArray: true, minItems: 1, maxItems: 1, example: [AppRole.STUDENT] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A person must have exactly one role' })
  @ArrayMaxSize(1, { message: 'A person must have exactly one role' })
  @IsEnum(AppRole, { each: true })
  roles: AppRole[];
}
