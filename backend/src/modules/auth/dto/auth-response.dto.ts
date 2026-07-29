import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthTokensDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn: number;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
