// PhotosService 단위 테스트.
//
// 학습 포인트:
// - Repository / MomentsService / R2Service 모두 mock으로 주입.
// - crypto.randomUUID는 결정적 — jest.spyOn(crypto, 'randomUUID')로 고정 가능.
// - 권한 검증 (다른 사용자 Moment 차단) + key prefix 검증 (조작 시도 차단) 우선.

import { HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { RestResponseCode, RestResponseType } from '../common';
import type { Moment } from '../moments/moment.entity';
import { MomentsService } from '../moments/moments.service';
import { R2Service } from '../r2/r2.service';

import { Photo } from './photo.entity';
import { PhotosService } from './photos.service';

describe('PhotosService', () => {
  let service: PhotosService;
  let photoRepo: jest.Mocked<Repository<Photo>>;
  let momentsService: jest.Mocked<MomentsService>;
  let r2Service: jest.Mocked<R2Service>;

  const mockUserId = 'user-uuid-1';
  const mockMomentId = 'moment-uuid-1';
  const mockMoment = { id: mockMomentId, userId: mockUserId } as Moment;

  beforeEach(async () => {
    photoRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as never;

    momentsService = {
      findMomentByIdAndUserId: jest.fn(),
    } as never;

    r2Service = {
      createPresignedPutUrl: jest.fn().mockResolvedValue('https://r2.../put?sig=...'),
      createPresignedGetUrl: jest.fn().mockResolvedValue('https://r2.../get?sig=...'),
      deleteObject: jest.fn(),
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: getRepositoryToken(Photo), useValue: photoRepo },
        { provide: MomentsService, useValue: momentsService },
        { provide: R2Service, useValue: r2Service },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  describe('createPresignedUploadUrl', () => {
    it('본인 Moment면 photoId/key 생성 + presigned PUT URL을 반환한다', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(mockMoment);

      const result = await service.createPresignedUploadUrl(mockUserId, mockMomentId, {
        ext: 'jpg',
      });

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.data?.photoId).toMatch(/^[0-9a-f-]+$/);
      expect(result.data?.key).toMatch(
        new RegExp(`^user/${mockUserId}/moments/${mockMomentId}/[0-9a-f-]+\\.jpg$`),
      );
      expect(result.data?.presignedUrl).toBe('https://r2.../put?sig=...');
      expect(result.data?.contentType).toBe('image/jpeg');

      expect(r2Service.createPresignedPutUrl).toHaveBeenCalledWith(
        expect.stringMatching(`^user/${mockUserId}/moments/${mockMomentId}/`),
        'image/jpeg',
      );
    });

    it('다른 사용자 Moment면 NOT_FOUND 응답', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(null);

      const result = await service.createPresignedUploadUrl(mockUserId, mockMomentId, {
        ext: 'jpg',
      });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.NOT_FOUND);
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(r2Service.createPresignedPutUrl).not.toHaveBeenCalled();
    });
  });

  describe('confirmPhotoUpload', () => {
    const photoId = 'photo-uuid-1';
    const validKey = `user/${mockUserId}/moments/${mockMomentId}/${photoId}.jpg`;

    it('본인 Moment + 올바른 key prefix면 Photo row 생성 + CREATED 응답', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(mockMoment);
      const savedPhoto = {
        id: photoId,
        momentId: mockMomentId,
        userId: mockUserId,
        originalKey: validKey,
        createdAt: new Date('2026-05-31T12:00:00Z'),
      } as Photo;
      photoRepo.create.mockReturnValue(savedPhoto);
      photoRepo.save.mockResolvedValue(savedPhoto);

      const result = await service.confirmPhotoUpload(mockUserId, mockMomentId, {
        photoId,
        key: validKey,
      });

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data?.id).toBe(photoId);
      expect(result.data?.originalKey).toBe(validKey);
      expect(photoRepo.create).toHaveBeenCalledWith({
        id: photoId,
        momentId: mockMomentId,
        userId: mockUserId,
        originalKey: validKey,
      });
    });

    it('다른 사용자 prefix key를 보내면 FORBIDDEN (조작 시도 차단)', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(mockMoment);
      const malicousKey = `user/other-user/moments/${mockMomentId}/${photoId}.jpg`;

      const result = await service.confirmPhotoUpload(mockUserId, mockMomentId, {
        photoId,
        key: malicousKey,
      });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.FORBIDDEN);
      expect(result.status).toBe(HttpStatus.FORBIDDEN);
      expect(photoRepo.save).not.toHaveBeenCalled();
    });

    it('다른 사용자 Moment면 NOT_FOUND (권한 검증 우선)', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(null);

      const result = await service.confirmPhotoUpload(mockUserId, mockMomentId, {
        photoId,
        key: validKey,
      });

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.NOT_FOUND);
      expect(photoRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findPhotosByMomentId', () => {
    it('본인 Moment의 사진 리스트 + 각 사진에 presigned GET URL', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(mockMoment);
      const photos = [
        {
          id: 'p1',
          momentId: mockMomentId,
          userId: mockUserId,
          originalKey: `user/${mockUserId}/moments/${mockMomentId}/p1.jpg`,
          createdAt: new Date('2026-05-31T12:00:00Z'),
        },
        {
          id: 'p2',
          momentId: mockMomentId,
          userId: mockUserId,
          originalKey: `user/${mockUserId}/moments/${mockMomentId}/p2.jpg`,
          createdAt: new Date('2026-05-31T12:01:00Z'),
        },
      ] as Photo[];
      photoRepo.find.mockResolvedValue(photos);

      const result = await service.findPhotosByMomentId(mockUserId, mockMomentId);

      expect(result.type).toBe(RestResponseType.SUCCESS);
      expect(result.data?.photos).toHaveLength(2);
      expect(result.data?.photos[0].originalUrl).toBe('https://r2.../get?sig=...');
      expect(r2Service.createPresignedGetUrl).toHaveBeenCalledTimes(2);
      expect(photoRepo.find).toHaveBeenCalledWith({
        where: { momentId: mockMomentId },
        order: { createdAt: 'ASC' },
      });
    });

    it('다른 사용자 Moment면 NOT_FOUND', async () => {
      momentsService.findMomentByIdAndUserId.mockResolvedValue(null);

      const result = await service.findPhotosByMomentId(mockUserId, mockMomentId);

      expect(result.type).toBe(RestResponseType.ERROR);
      expect(result.code).toBe(RestResponseCode.NOT_FOUND);
    });
  });
});
