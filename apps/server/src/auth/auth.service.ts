// AuthService — 인증 흐름의 비즈니스 로직.
//
// 책임:
// - signup: 이메일 중복 검증 + password bcrypt hash + user 생성 + token 발급
// - login: email/password 검증 + token 발급
// - refresh: refresh token 검증 + 새 access token 발급
//
// 학습 포인트:
// - bcrypt cost factor 10: 2^10 = 1024 rounds. 2026 기준 12 권장하지만 사이드는 10도 OK.
// - JWT 두 secret 별개: access secret 유출 시 refresh 안전 + 키 회전 가능.
// - 본 ADR 결정: Stateless 패턴 (logout 시 서버 측 처리 X, 만료만).
//   Phase 4 운영 진입 시 Redis blacklist 또는 token rotation 도입 검토.

import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { UsersService } from '../users/users.service';

const BCRYPT_COST = 10;

/** JWT payload — sub은 표준 claim (subject = user id) */
export interface JwtPayload {
  sub: string;
  email?: string;
}

export interface TokenPair {
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
  async signup(email: string, password: string): Promise<TokenPair> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await this.usersService.create({ email, passwordHash });

    return this.issueTokens({ sub: user.id, email: user.email });
  }

  /** 로그인 — email/password 검증 + token 발급 */
  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      // 이메일 존재 여부 노출 안 하려고 일반화된 메시지
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    return this.issueTokens({ sub: user.id, email: user.email });
  }

  /**
   * Refresh — 유효한 refresh token으로 새 access(+refresh) 발급.
   * Stateless 패턴 (서버 측 token 저장 X). 도난 위험은 access 15분으로 최소화.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh token');
    }

    // user 존재 검증 (계정 삭제됐을 가능성 방어)
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('계정을 찾을 수 없습니다');
    }

    return this.issueTokens({ sub: user.id, email: user.email });
  }

  /**
   * Logout — Stateless 패턴이라 서버 측 처리 없음.
   * 클라이언트가 secure storage에서 token 삭제하는 것으로 완료.
   *
   * Phase 4 운영 진입 시 Redis blacklist 도입 검토:
   * - refresh token jti(JWT ID)를 Redis에 박제 → verify 시 확인
   * - 즉시 무효화 가능 (현재 stateless는 만료까지 유효)
   */
  async logout(): Promise<void> {
    return Promise.resolve();
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
