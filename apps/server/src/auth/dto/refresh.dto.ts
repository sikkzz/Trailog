// RefreshDto — POST /auth/refresh 입력 검증.
//
// refresh token만 body로 받음. (Authorization 헤더로 받는 패턴도 있지만,
// Bearer는 access token 전용으로 두고 refresh는 body로 받는 게 명확.)

import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: 'login 시 받은 refreshToken (JWT 형식)',
  })
  @IsString()
  @IsJWT({ message: '유효하지 않은 token 형식' })
  refreshToken!: string;
}
