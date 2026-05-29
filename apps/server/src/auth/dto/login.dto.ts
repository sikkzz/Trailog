// LoginDto — POST /auth/login 입력 검증.
//
// signup과 비슷하지만 password 검증 룰은 최소 (이미 가입된 사용자가
// 옛 password 정책으로 들어왔을 수 있어서 너무 엄격 X — 그건 signup만).

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@trailog.app', description: '가입한 이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  email!: string;

  @ApiProperty({ example: 'mypassword123', description: '비밀번호' })
  @IsString({ message: '비밀번호를 입력하세요' })
  password!: string;
}
