// UsersService 단위 테스트.
//
// 학습 포인트:
// - TypeORM Repository는 mock 객체로 주입 (실제 DB 안 띄움).
// - createQueryBuilder는 체이닝 인터페이스라 mock도 체이닝 반환 필요 (returnThis).
// - AC 기반 it() — 룰에 따라 한국어로 명확히.

import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';

import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;
  let queryBuilder: jest.Mocked<Pick<SelectQueryBuilder<User>, 'addSelect' | 'where' | 'getOne'>>;

  beforeEach(async () => {
    // createQueryBuilder 체이닝 mock — addSelect/where는 자기 자신 반환, getOne만 결과 반환
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    } as never;

    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: userRepo }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findUserByEmail', () => {
    it('이메일로 user를 조회하면 user를 반환한다', async () => {
      const mockUser = { id: 'uuid-1', email: 'a@trailog.app' } as User;
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserByEmail('a@trailog.app');

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'a@trailog.app' } });
    });

    it('이메일에 해당하는 user가 없으면 null을 반환한다', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findUserByEmail('missing@trailog.app');

      expect(result).toBeNull();
    });
  });

  describe('findUserByEmailWithPassword', () => {
    it('password 컬럼을 명시적으로 select해서 조회한다', async () => {
      const mockUser = { id: 'uuid-1', email: 'a@trailog.app', password: 'hash' } as User;
      queryBuilder.getOne.mockResolvedValue(mockUser);

      const result = await service.findUserByEmailWithPassword('a@trailog.app');

      expect(result).toEqual(mockUser);
      expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.password');
      expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
        email: 'a@trailog.app',
      });
    });
  });

  describe('findUserById', () => {
    it('id로 user를 조회하면 user를 반환한다', async () => {
      const mockUser = { id: 'uuid-1', email: 'a@trailog.app' } as User;
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserById('uuid-1');

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    });
  });

  describe('createUser', () => {
    it('email + passwordHash로 새 user를 저장한다', async () => {
      const entity = { email: 'new@trailog.app', password: 'hashed' } as User;
      const saved = { ...entity, id: 'uuid-new' } as User;
      userRepo.create.mockReturnValue(entity);
      userRepo.save.mockResolvedValue(saved);

      const result = await service.createUser({
        email: 'new@trailog.app',
        passwordHash: 'hashed',
      });

      expect(result).toEqual(saved);
      expect(userRepo.create).toHaveBeenCalledWith({
        email: 'new@trailog.app',
        password: 'hashed',
      });
      expect(userRepo.save).toHaveBeenCalledWith(entity);
    });
  });
});
