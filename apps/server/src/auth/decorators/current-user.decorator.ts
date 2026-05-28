// @CurrentUser() decorator — Controller에서 인증된 user를 깔끔하게 받기.
//
// 사용 예:
//   @UseGuards(JwtAuthGuard)
//   @Get('me')
//   getMe(@CurrentUser() user: User) {
//     return user;
//   }
//
// 학습 포인트:
// - createParamDecorator: NestJS가 controller 메서드 인자에 값 주입.
// - ExecutionContext: HTTP/WebSocket/RPC 모두 지원. switchToHttp()로 HTTP request 추출.
// - request.user: JwtStrategy.validate()가 반환한 user 객체 (Passport가 자동 박음).
//
// 안전망 (참조 패턴 채택):
// - JwtAuthGuard와 짝지어 쓰는 게 전제지만, 새 개발자가 @UseGuards 깜빡할 위험 방어.
// - req.user 없으면 401 throw — 명시적 보안 layer + 디버깅 친화.
// - 타입은 User로 박혀있어 IDE/TS는 경고 못 하니까 런타임 가드 필수.
//
// 참조 패턴 비교:
// - 회사: @UserParam (필수, 401 throw) + @OptionalUserParam (선택)
// - Trailog: 일단 @CurrentUser (필수)만. 선택적 인증 route 등장 시
//   @OptionalCurrentUser 추가 (auth-deep-dive-revisit 메모리).

import { type ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { User } from '../../users/user.entity';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<{ user?: User }>();

  if (!request.user) {
    // @UseGuards(JwtAuthGuard)가 빠진 route에서 호출됐을 때 명시적 차단.
    // Guard 정상 통과 후엔 항상 박혀있으므로 정상 흐름에선 발생 X.
    throw new UnauthorizedException('인증 정보가 없습니다');
  }

  return request.user;
});
