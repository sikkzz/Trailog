// JwtAuthGuard — Route 보호용 Guard.
//
// 학습 포인트:
// - AuthGuard('jwt')는 @nestjs/passport가 제공하는 helper. 'jwt' = strategy 이름.
//   JwtStrategy의 PassportStrategy(Strategy)가 자동으로 'jwt' 이름 등록.
// - Controller에서 @UseGuards(JwtAuthGuard) → 요청마다 JwtStrategy 실행.
// - 검증 실패 시 401 자동 응답. 성공 시 req.user에 user 객체 박힘.
// - 참조 패턴은 9개 Guard로 시나리오별 분리 (optional-auth, admin-auth, user-block 등).
//   Trailog는 단순 시작 — 필요 시점에 확장 (auth-deep-dive-revisit 메모리).

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
