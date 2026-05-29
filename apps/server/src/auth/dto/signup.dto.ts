// SignupDto — POST /auth/signup 입력 검증.
//
// 학습 포인트:
// - class-validator 데코레이터로 런타임 검증 (NestJS ValidationPipe가 자동 호출).
// - @IsEmail: RFC 5322 기반 이메일 형식 검증. 정규식 직접 작성보다 안전.
// - @MinLength(8): OWASP 최소 권장. 참조처럼 복잡도(대소문자+숫자) 룰은
//   Phase 4 출시 직전 검토 (auth-deep-dive-revisit 메모리).
// - @MaxLength(72): bcrypt 한계. 72 byte 초과 시 무시되니 명시적 제약.

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    example: 'user@trailog.app',
    description: '이메일 (RFC 5322 형식)',
  })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  email!: string;

  @ApiProperty({
    example: 'mypassword123',
    minLength: 8,
    maxLength: 72,
    description: '비밀번호 — 8자 이상 72자 이하 (bcrypt 한계)',
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 합니다' })
  password!: string;
}
