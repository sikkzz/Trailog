// SignInRequestDto / SignInResponseDto — POST /auth/sign-in.
//
// sign-up과 비슷하지만 password 검증 룰은 최소 (이미 가입된 사용자가
// 옛 password 정책으로 들어왔을 수 있어서 너무 엄격 X — 그건 sign-up만).

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class SignInRequestDto {
  @ApiProperty({ example: 'user@trailog.app', description: '가입한 이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  email!: string;

  @ApiProperty({ example: 'mypassword123', description: '비밀번호' })
  @IsString({ message: '비밀번호를 입력하세요' })
  password!: string;
}

export class SignInResponseDto {
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
