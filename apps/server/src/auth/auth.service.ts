// AuthService — 인증 흐름의 비즈니스 로직.
//
// 책임:
// - signUp: 이메일 중복 검증 + password bcrypt hash + user 생성 + token 발급
// - signIn: email/password 검증 + token 발급
// - refreshTokens: refresh token 검증 + 새 token pair 발급
// - signOut: Stateless (no-op). Phase 4에 Redis blacklist 도입 검토.
//
// 학습 포인트:
// - bcrypt cost factor 10: 2^10 = 1024 rounds. 2026 기준 12 권장하지만 사이드는 10도 OK.
// - JWT 두 secret 별개: access secret 유출 시 refresh 안전 + 키 회전 가능.
// - 본 ADR 결정: Stateless 패턴 (logout 시 서버 측 처리 X, 만료만).
// - 응답은 RestResponse<T>로 표준화 — 모바일 client가 code/method enum으로 자동 액션 결정.

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';

import { RestResponse, RestResponseCode, RestResponseMethod } from '../common';
import { UsersService } from '../users/users.service';

import { RefreshTokenRequestDto, RefreshTokenResponseDto } from './dtos/refresh-token.dto';
import { SignInRequestDto, SignInResponseDto } from './dtos/sign-in.dto';
import { SignUpRequestDto, SignUpResponseDto } from './dtos/sign-up.dto';

const BCRYPT_COST = 10;

/** JWT payload — sub은 표준 claim (subject = user id) */
export interface JwtPayload {
  sub: string;
  email?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** 회원가입 — 이메일 unique 제약 + bcrypt hash + token 발급 */
  async signUp(dto: SignUpRequestDto): Promise<RestResponse<SignUpResponseDto>> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      return new RestResponse<SignUpResponseDto>().error('이미 가입된 이메일입니다', {
        code: RestResponseCode.DUPLICATE_ERROR,
        status: HttpStatus.CONFLICT,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.usersService.create({ email: dto.email, passwordHash });

    const tokens = await this.issueTokens({ sub: user.id, email: user.email });
    return new RestResponse<SignUpResponseDto>().success(tokens, {
      status: HttpStatus.CREATED,
    });
  }

  /** 로그인 — email/password 검증 + token 발급 */
  async signIn(dto: SignInRequestDto): Promise<RestResponse<SignInResponseDto>> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      // 이메일 존재 여부 노출 안 하려고 일반화된 메시지
      return new RestResponse<SignInResponseDto>().error(
        '이메일 또는 비밀번호가 올바르지 않습니다',
        {
          code: RestResponseCode.UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
        },
      );
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      return new RestResponse<SignInResponseDto>().error(
        '이메일 또는 비밀번호가 올바르지 않습니다',
        {
          code: RestResponseCode.UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
        },
      );
    }

    const tokens = await this.issueTokens({ sub: user.id, email: user.email });
    return new RestResponse<SignInResponseDto>().success(tokens);
  }

  /**
   * Refresh — 유효한 refresh token으로 새 access(+refresh) 발급.
   * Stateless 패턴 (서버 측 token 저장 X). 도난 위험은 access 15분으로 최소화.
   *
   * method=LOG_OUT: refresh가 무효하면 모바일이 secure storage 비우고 로그인 화면 이동.
   */
  async refreshTokens(dto: RefreshTokenRequestDto): Promise<RestResponse<RefreshTokenResponseDto>> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      return new RestResponse<RefreshTokenResponseDto>().error('유효하지 않은 refresh token', {
        code: RestResponseCode.TOKEN_EXPIRED,
        status: HttpStatus.UNAUTHORIZED,
        method: RestResponseMethod.LOG_OUT,
      });
    }

    // user 존재 검증 (계정 삭제됐을 가능성 방어)
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      return new RestResponse<RefreshTokenResponseDto>().error('계정을 찾을 수 없습니다', {
        code: RestResponseCode.NOT_FOUND,
        status: HttpStatus.UNAUTHORIZED,
        method: RestResponseMethod.LOG_OUT,
      });
    }

    const tokens = await this.issueTokens({ sub: user.id, email: user.email });
    return new RestResponse<RefreshTokenResponseDto>().success(tokens);
  }

  /**
   * Sign-out — Stateless 패턴이라 서버 측 처리 없음.
   * 클라이언트가 secure storage에서 token 삭제하는 것으로 완료.
   *
   * Phase 4 운영 진입 시 Redis blacklist 도입 검토:
   * - refresh token jti(JWT ID)를 Redis에 박제 → verify 시 확인
   * - 즉시 무효화 가능 (현재 stateless는 만료까지 유효)
   */
  async signOut(): Promise<RestResponse<null>> {
    return new RestResponse<null>().success(null, { status: HttpStatus.NO_CONTENT });
  }

  /** 두 token 동시 발급 — payload는 동일 (sub 기준), 만료/secret만 차이 */
  private async issueTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    // jsonwebtoken@9의 expiresIn은 'StringValue | number' (ms 라이브러리 형식).
    // ConfigService에서 받은 string을 SignOptions['expiresIn'] 타입으로 캐스트.
    const accessExpiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    ) as SignOptions['expiresIn'];
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) as SignOptions['expiresIn'];

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      // refresh payload는 email 빼고 sub만 — 최소 노출 원칙
      this.jwtService.signAsync(
        { sub: payload.sub },
        { secret: refreshSecret, expiresIn: refreshExpiresIn },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
