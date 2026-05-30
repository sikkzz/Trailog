// AuthService 단위 테스트.
//
// 학습 포인트:
// - UsersService / JwtService / ConfigService 모두 mock으로 주입 (외부 IO 없이 순수 로직 검증).
// - bcrypt는 그대로 사용 (실제 hash/compare 동작 검증). cost factor 10이 좀 느리긴 하지만 OK.
// - RestResponse 반환 패턴 검증 — type/code/method/status 모두 확인.
// - AC 기반 it() — Phase 2 spec 4.1의 수용 기준을 그대로 케이스 제목으로.

import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { RestResponseCode, RestResponseMethod, RestResponseType } from '../common';
import type { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    usersService = {
      findUserByEmail: jest.fn(),
      findUserByEmailWithPassword: jest.fn(),
      findUserById: jest.fn(),
      createUser: jest.fn(),
    } as never;

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    } as never;

    configService = {
      get: jest.fn().mockImplementation((_key: string, fallback?: unknown) => fallback),
      getOrThrow: jest.fn().mockImplementation((key: string) => `secret-for-${key}`),
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signUp', () => {
    it('새 이메일로 가입하면 TokenPair를 담은 성공 응답을 반환한다', async () => {
      usersService.findUserByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue({ id: 'uuid-1', email: 'new@trailog.app' } as User);

      const result = await service.signUp({
        email: 'new@trailog.app',
        password: 'password123',
      });

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.code).toBe(RestResponseCode.NORMAL);
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('비밀번호는 bcrypt로 hash되어 저장된다 (평문 저장 X)', async () => {
      usersService.findUserByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue({ id: 'uuid-1', email: 'new@trailog.app' } as User);

      await service.signUp({ email: 'new@trailog.app', password: 'password123' });

      const callArg = usersService.createUser.mock.calls[0][0];
      expect(callArg.passwordHash).not.toBe('password123');
      const isMatch = await bcrypt.compare('password123', callArg.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('이미 가입된 이메일이면 DUPLICATE_ERROR + 409 응답을 반환한다', async () => {
      usersService.findUserByEmail.mockResolvedValue({ id: 'existing' } as User);

      const result = await service.signUp({
        email: 'existing@trailog.app',
        password: 'password123',
      });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.DUPLICATE_ERROR);
      expect(result.status).toBe(HttpStatus.CONFLICT);
      expect(result.message).toBe('이미 가입된 이메일입니다');
      expect(usersService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('이메일 + 비밀번호가 일치하면 TokenPair를 담은 성공 응답을 반환한다', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findUserByEmailWithPassword.mockResolvedValue({
        id: 'uuid-1',
        email: 'user@trailog.app',
        password: passwordHash,
      } as User);

      const result = await service.signIn({
        email: 'user@trailog.app',
        password: 'password123',
      });

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.data).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('이메일이 없으면 UNAUTHORIZED + 401 응답을 반환한다 (이메일 존재 여부 노출 X)', async () => {
      usersService.findUserByEmailWithPassword.mockResolvedValue(null);

      const result = await service.signIn({
        email: 'missing@trailog.app',
        password: 'password123',
      });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.UNAUTHORIZED);
      expect(result.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(result.message).toBe('이메일 또는 비밀번호가 올바르지 않습니다');
    });

    it('비밀번호가 일치하지 않으면 UNAUTHORIZED + 401 응답을 반환한다 (메시지는 이메일 없음과 동일)', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersService.findUserByEmailWithPassword.mockResolvedValue({
        id: 'uuid-1',
        email: 'user@trailog.app',
        password: passwordHash,
      } as User);

      const result = await service.signIn({
        email: 'user@trailog.app',
        password: 'wrong-password',
      });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.UNAUTHORIZED);
      expect(result.message).toBe('이메일 또는 비밀번호가 올바르지 않습니다');
    });
  });

  describe('refreshTokens', () => {
    it('유효한 refresh token으로 새 TokenPair를 발급한다', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'uuid-1' });
      usersService.findUserById.mockResolvedValue({
        id: 'uuid-1',
        email: 'user@trailog.app',
      } as User);

      const result = await service.refreshTokens({ refreshToken: 'valid-token' });

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.data).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('refresh token이 유효하지 않으면 TOKEN_EXPIRED + LOG_OUT method를 반환한다', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      const result = await service.refreshTokens({ refreshToken: 'invalid-token' });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.TOKEN_EXPIRED);
      expect(result.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(result.method).toBe(RestResponseMethod.LOG_OUT);
      expect(result.message).toBe('유효하지 않은 refresh token');
    });

    it('refresh token은 유효하지만 user가 삭제된 경우 NOT_FOUND + LOG_OUT method를 반환한다', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'uuid-deleted' });
      usersService.findUserById.mockResolvedValue(null);

      const result = await service.refreshTokens({ refreshToken: 'valid-token' });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.NOT_FOUND);
      expect(result.method).toBe(RestResponseMethod.LOG_OUT);
      expect(result.message).toBe('계정을 찾을 수 없습니다');
    });
  });

  describe('signOut', () => {
    it('Stateless이므로 NO_CONTENT 성공 응답만 반환한다', async () => {
      const result = await service.signOut();

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.status).toBe(HttpStatus.NO_CONTENT);
      expect(result.data).toBeNull();
    });
  });
});
