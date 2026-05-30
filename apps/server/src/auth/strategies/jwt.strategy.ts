// JwtStrategy — Passport JWT strategy.
//
// 학습 포인트:
// - PassportStrategy(Strategy): @nestjs/passport가 passport-jwt의 Strategy를 wrap.
//   상속받은 클래스의 constructor에서 super() 호출 시 strategy 옵션 전달.
// - ExtractJwt.fromAuthHeaderAsBearerToken(): Authorization 헤더의 'Bearer xxx' 패턴에서 token 추출.
//   다른 옵션: fromUrlQueryParameter('token'), fromBodyField('token') 등.
//   Bearer header가 모바일 표준 (Q2 결정).
// - secretOrKey: 검증용 secret. ACCESS_SECRET 사용 (refresh는 AuthService.refresh에서 별도 검증).
// - ignoreExpiration: false → 만료 토큰 자동 거절.
// - validate(payload): signature + expiration 검증 후 호출. 여기서 DB 조회 → user 반환 →
//   NestJS가 Request.user에 박음. 이후 controller에서 @CurrentUser()로 접근.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  /**
   * payload signature/expiration 검증 후 호출.
   * 반환된 user는 Request.user에 박힘 → @CurrentUser()로 접근 가능.
   * user 못 찾으면 401 (DB에서 삭제된 계정 등).
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('계정을 찾을 수 없습니다');
    }
    return user;
  }
}
