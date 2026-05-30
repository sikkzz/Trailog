// AuthController — 인증 HTTP 표면.
//
// 학습 포인트:
// - @Body() — ValidationPipe가 자동으로 DTO로 변환 + 검증 (main.ts에서 global 설정).
// - 응답은 RestResponse<T>로 표준화 — service가 이미 wrap된 객체 반환.
// - @HttpCode: status는 RestResponse 안의 status로 통일되므로 controller에선 지정 X.
//   (Phase 후속 ResponseInterceptor 도입 시 자동 status 설정. 현재는 RestResponse.status 그대로.)

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RestResponse } from '../common';
import type { User } from '../users/user.entity';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenRequestDto, RefreshTokenResponseDto } from './dtos/refresh-token.dto';
import { SignInRequestDto, SignInResponseDto } from './dtos/sign-in.dto';
import { SignUpRequestDto, SignUpResponseDto } from './dtos/sign-up.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /auth/sign-up — 회원가입 + token 발급 */
  @Post('sign-up')
  @ApiOperation({ summary: '회원가입', description: '이메일/비밀번호 회원가입 + 즉시 token 발급' })
  @ApiOkResponse({ description: '성공 — token pair 발급', type: SignUpResponseDto })
  async signUp(@Body() dto: SignUpRequestDto): Promise<RestResponse<SignUpResponseDto>> {
    return this.authService.signUp(dto);
  }

  /** POST /auth/sign-in — 로그인 + token 발급 */
  @Post('sign-in')
  @ApiOperation({ summary: '로그인', description: '이메일/비밀번호 검증 + token 발급' })
  @ApiOkResponse({ description: '성공 — token pair 발급', type: SignInResponseDto })
  async signIn(@Body() dto: SignInRequestDto): Promise<RestResponse<SignInResponseDto>> {
    return this.authService.signIn(dto);
  }

  /** POST /auth/refresh — refresh token으로 새 token pair 발급 */
  @Post('refresh')
  @ApiOperation({
    summary: 'Token 갱신',
    description: 'refresh token으로 새 access + refresh token 발급',
  })
  @ApiOkResponse({ description: '성공 — 새 token pair', type: RefreshTokenResponseDto })
  async refreshTokens(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<RestResponse<RefreshTokenResponseDto>> {
    return this.authService.refreshTokens(dto);
  }

  /**
   * POST /auth/sign-out — Stateless (no-op).
   * 클라이언트가 secure storage에서 token 삭제하는 것으로 완료.
   * Phase 4 운영 진입 시 Redis blacklist 도입 검토.
   */
  @Post('sign-out')
  @ApiOperation({
    summary: '로그아웃',
    description:
      'Stateless 패턴 (서버 측 처리 없음). 클라이언트가 secure storage에서 token 삭제로 완료. Phase 4에 Redis blacklist 도입 검토.',
  })
  @ApiOkResponse({ description: '성공' })
  async signOut(): Promise<RestResponse<null>> {
    return this.authService.signOut();
  }

  /**
   * GET /auth/me — 현재 로그인 사용자 정보.
   * JwtAuthGuard + @CurrentUser 사용 첫 예시.
   * 클라이언트가 token 유효성 확인 + 본인 정보 조회용.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 정보 조회',
    description: 'JWT access token으로 본인 정보 조회. token 유효성 확인용도.',
  })
  @ApiOkResponse({ description: '성공 — 사용자 id + email' })
  getMe(@CurrentUser() user: User): RestResponse<{ id: string; email: string }> {
    return new RestResponse<{ id: string; email: string }>().success({
      id: user.id,
      email: user.email,
    });
  }
}
