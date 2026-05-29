// AuthController — 인증 HTTP 표면.
//
// 학습 포인트:
// - @Body() — ValidationPipe가 자동으로 DTO로 변환 + 검증 (main.ts에서 global 설정).
// - @HttpCode(200): POST는 기본 201. login/refresh는 새 리소스 생성 아니라 200이 의미 맞음.
//   signup만 201 (User 생성).
// - logout은 stateless이라 실제 동작 X (no-op). 204 No Content.
//   Phase 4 운영 진입 시 Redis blacklist로 즉시 무효화 (auth-deep-dive-revisit 메모리).

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /auth/signup — 회원가입 + token 발급 */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '회원가입', description: '이메일/비밀번호 회원가입 + 즉시 token 발급' })
  @ApiResponse({ status: 201, description: '성공 — token pair 발급', type: TokenResponseDto })
  @ApiResponse({ status: 400, description: '입력 검증 실패 (이메일 형식, 비밀번호 길이 등)' })
  @ApiResponse({ status: 409, description: '이미 가입된 이메일' })
  async signup(@Body() dto: SignupDto): Promise<TokenResponseDto> {
    return this.authService.signup(dto.email, dto.password);
  }

  /** POST /auth/login — 로그인 + token 발급 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인', description: '이메일/비밀번호 검증 + token 발급' })
  @ApiResponse({ status: 200, description: '성공 — token pair 발급', type: TokenResponseDto })
  @ApiResponse({ status: 401, description: '이메일 또는 비밀번호 불일치' })
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  /** POST /auth/refresh — refresh token으로 새 access token 발급 */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Token 갱신',
    description: 'refresh token으로 새 access + refresh token 발급',
  })
  @ApiResponse({ status: 200, description: '성공 — 새 token pair', type: TokenResponseDto })
  @ApiResponse({ status: 401, description: '유효하지 않거나 만료된 refresh token' })
  async refresh(@Body() dto: RefreshDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * POST /auth/logout — Stateless (no-op).
   * 클라이언트가 secure storage에서 token 삭제하는 것으로 완료.
   * Phase 4 운영 진입 시 Redis blacklist 도입 검토.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '로그아웃',
    description:
      'Stateless 패턴 (서버 측 처리 없음). 클라이언트가 secure storage에서 token 삭제로 완료. Phase 4에 Redis blacklist 도입 검토.',
  })
  @ApiResponse({ status: 204, description: '성공' })
  async logout(): Promise<void> {
    return this.authService.logout();
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
  @ApiResponse({ status: 200, description: '성공 — 사용자 id + email' })
  @ApiResponse({ status: 401, description: 'token 없음/만료/유효하지 않음' })
  getMe(@CurrentUser() user: User): { id: string; email: string } {
    return { id: user.id, email: user.email };
  }
}
