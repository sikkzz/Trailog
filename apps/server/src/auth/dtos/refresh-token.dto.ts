// RefreshTokenRequestDto / RefreshTokenResponseDto — POST /auth/refresh.
//
// refresh token만 body로 받음. (Authorization 헤더로 받는 패턴도 있지만,
// Bearer는 access token 전용으로 두고 refresh는 body로 받는 게 명확.)

import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: 'sign-in 시 받은 refreshToken (JWT 형식)',
  })
  @IsString()
  @IsJWT({ message: '유효하지 않은 token 형식' })
  refreshToken!: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: '새 JWT access token (15분 만료)',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: '새 JWT refresh token (7일 만료)',
  })
  refreshToken!: string;
}
