// MomentsService 단위 테스트.
//
// 학습 포인트:
// - Repository는 mock으로 주입 (DB 안 띄움).
// - findByUserId는 본인 것만 — where 절에 userId 박힌 호출인지 검증.
// - 응답 RestResponse 구조 검증 (type/code/status/data).

import { HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { RestResponseCode, RestResponseType } from '../common';

import type { CreateMomentRequestDto } from './dtos/create-moment.dto';
import { Moment } from './moment.entity';
import { MomentsService } from './moments.service';

describe('MomentsService', () => {
  let service: MomentsService;
  let momentRepo: jest.Mocked<Repository<Moment>>;

  const mockUserId = 'user-uuid-1';
  const mockMoment = {
    id: 'moment-uuid-1',
    userId: mockUserId,
    title: '도쿄 여행',
    startedAt: new Date('2026-04-15T00:00:00Z'),
    endedAt: new Date('2026-04-22T00:00:00Z'),
    createdAt: new Date('2026-05-30T12:00:00Z'),
    updatedAt: new Date('2026-05-30T12:00:00Z'),
  } as Moment;

  beforeEach(async () => {
    momentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MomentsService, { provide: getRepositoryToken(Moment), useValue: momentRepo }],
    }).compile();

    service = module.get<MomentsService>(MomentsService);
  });

  describe('createMoment', () => {
    it('userId + dto로 새 moment를 생성하고 CREATED 응답을 반환한다', async () => {
      const dto: CreateMomentRequestDto = {
        title: '도쿄 여행',
        startedAt: '2026-04-15T00:00:00Z',
        endedAt: '2026-04-22T00:00:00Z',
      };
      momentRepo.create.mockReturnValue(mockMoment);
      momentRepo.save.mockResolvedValue(mockMoment);

      const result = await service.createMoment(mockUserId, dto);

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.code).toBe(RestResponseCode.NORMAL);
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual({
        id: 'moment-uuid-1',
        title: '도쿄 여행',
        startedAt: '2026-04-15T00:00:00.000Z',
        endedAt: '2026-04-22T00:00:00.000Z',
        createdAt: '2026-05-30T12:00:00.000Z',
        updatedAt: '2026-05-30T12:00:00.000Z',
      });

      expect(momentRepo.create).toHaveBeenCalledWith({
        userId: mockUserId,
        title: '도쿄 여행',
        startedAt: new Date('2026-04-15T00:00:00Z'),
        endedAt: new Date('2026-04-22T00:00:00Z'),
      });
    });

    it('startedAt/endedAt 없으면 null로 저장한다 (단발 방문 케이스)', async () => {
      const dto: CreateMomentRequestDto = { title: '성수 ABC 카페' };
      const momentWithoutDates = { ...mockMoment, startedAt: null, endedAt: null } as Moment;
      momentRepo.create.mockReturnValue(momentWithoutDates);
      momentRepo.save.mockResolvedValue(momentWithoutDates);

      const result = await service.createMoment(mockUserId, dto);

      expect(result.data?.startedAt).toBeNull();
      expect(result.data?.endedAt).toBeNull();
      expect(momentRepo.create).toHaveBeenCalledWith({
        userId: mockUserId,
        title: '성수 ABC 카페',
        startedAt: null,
        endedAt: null,
      });
    });
  });

  describe('findMomentsByUserId', () => {
    it('본인 userId의 moment 리스트를 createdAt DESC로 반환한다', async () => {
      const moments = [
        mockMoment,
        { ...mockMoment, id: 'moment-uuid-2', title: '성수 카페' } as Moment,
      ];
      momentRepo.find.mockResolvedValue(moments);

      const result = await service.findMomentsByUserId(mockUserId);

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.data?.moments).toHaveLength(2);
      expect(result.data?.moments[0].title).toBe('도쿄 여행');
      expect(result.data?.moments[1].title).toBe('성수 카페');

      expect(momentRepo.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
      });
    });

    it('moment가 없으면 빈 배열을 반환한다', async () => {
      momentRepo.find.mockResolvedValue([]);

      const result = await service.findMomentsByUserId(mockUserId);

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.data?.moments).toEqual([]);
    });
  });
});
