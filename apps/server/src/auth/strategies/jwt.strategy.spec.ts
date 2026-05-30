// JwtStrategy 단위 테스트.
//
// 학습 포인트:
// - PassportStrategy(Strategy)는 constructor 안에서 configService.getOrThrow('JWT_SECRET') 호출 →
//   모듈 인스턴스화 시 JWT_SECRET이 있어야 함. Test.createTestingModule도 동일.
// - validate(payload)는 passport가 signature/expiration 검증 후 호출 →
//   여기선 DB 조회 + user 반환만 검증.

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import type { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    usersService = {
      findUserById: jest.fn(),
    } as never;

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('payload의 sub로 user를 찾으면 그 user를 반환한다', async () => {
      const mockUser = { id: 'uuid-1', email: 'user@trailog.app' } as User;
      usersService.findUserById.mockResolvedValue(mockUser);

      const result = await strategy.validate({ sub: 'uuid-1', email: 'user@trailog.app' });

      expect(result).toEqual(mockUser);
      expect(usersService.findUserById).toHaveBeenCalledWith('uuid-1');
    });

    it('user를 찾지 못하면 UnauthorizedException을 던진다 (계정 삭제 등)', async () => {
      usersService.findUserById.mockResolvedValue(null);

      await expect(strategy.validate({ sub: 'uuid-deleted' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
