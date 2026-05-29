// TokenResponseDto — 모든 인증 endpoint의 success 응답 형태.
//
// 모바일 클라이언트가 expo-secure-store에 저장 + interceptor가 사용.
// 응답에 user 정보를 함께 줄지는 Phase 3에 검토 (현재는 토큰만).

import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: 'JWT access token (15분 만료). Authorization: Bearer <token>으로 사용',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: 'JWT refresh token (7일 만료). access 만료 시 /auth/refresh로 갱신',
  })
  refreshToken!: string;
}
