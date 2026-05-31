// PhotosService — Photo 도메인 비즈니스 로직.
//
// 책임:
// - createPresignedUploadUrl: photoId/key 생성 + Moment 권한 확인 + presigned PUT URL 발급
// - confirmPhotoUpload: 모바일이 R2 PUT 성공 알림 → Photo row 생성 + presigned GET URL 응답
// - findPhotosByMomentId: Moment의 사진 리스트 + 각 사진 presigned GET URL
//
// 학습 포인트:
// - photoId는 uuid v4 (crypto.randomUUID) 백엔드 생성 — 모바일이 박지 못함
// - key는 백엔드 강제: `user/{userId}/moments/{momentId}/{photoId}.{ext}`
// - 권한 검증: MomentsService.findMomentByIdAndUserId — 본인 Moment 아니면 NOT_FOUND
// - confirm 시 받은 key가 본인 prefix인지 재검증 (모바일 조작 시도 차단)

import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { RestResponse, RestResponseCode } from '../common';
import { MomentsService } from '../moments/moments.service';
import { R2Service } from '../r2/r2.service';

import {
  CreateUploadUrlRequestDto,
  CreateUploadUrlResponseDto,
} from './dtos/create-upload-url.dto';
import { ConfirmPhotoRequestDto, ConfirmPhotoResponseDto } from './dtos/confirm-photo.dto';
import { GetPhotosResponseDto, PhotoListItemDto } from './dtos/get-photos.dto';
import { Photo } from './photo.entity';
import type { PhotoProcessingJobData } from './photo-processing.types';
import { PHOTO_PROCESSING_QUEUE } from './photos.constants';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(Photo)
    private readonly photoRepo: Repository<Photo>,
    private readonly momentsService: MomentsService,
    private readonly r2Service: R2Service,
    @InjectQueue(PHOTO_PROCESSING_QUEUE)
    private readonly photoProcessingQueue: Queue<PhotoProcessingJobData>,
  ) {}

  /** Presigned PUT URL 발급 — Moment 권한 확인 + key 강제 생성. */
  async createPresignedUploadUrl(
    userId: string,
    momentId: string,
    dto: CreateUploadUrlRequestDto,
  ): Promise<RestResponse<CreateUploadUrlResponseDto>> {
    const moment = await this.momentsService.findMomentByIdAndUserId(momentId, userId);
    if (!moment) {
      return new RestResponse<CreateUploadUrlResponseDto>().error('Moment를 찾을 수 없습니다', {
        code: RestResponseCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const photoId = randomUUID();
    const key = this.buildKey(userId, momentId, photoId, dto.ext);
    const contentType = EXT_TO_MIME[dto.ext];
    const presignedUrl = await this.r2Service.createPresignedPutUrl(key, contentType);

    return new RestResponse<CreateUploadUrlResponseDto>().success({
      photoId,
      key,
      presignedUrl,
      contentType,
    });
  }

  /** 업로드 완료 알림 → Photo row 생성. key prefix 재검증으로 cross-user 차단. */
  async confirmPhotoUpload(
    userId: string,
    momentId: string,
    dto: ConfirmPhotoRequestDto,
  ): Promise<RestResponse<ConfirmPhotoResponseDto>> {
    const moment = await this.momentsService.findMomentByIdAndUserId(momentId, userId);
    if (!moment) {
      return new RestResponse<ConfirmPhotoResponseDto>().error('Moment를 찾을 수 없습니다', {
        code: RestResponseCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const expectedPrefix = `user/${userId}/moments/${momentId}/${dto.photoId}.`;
    if (!dto.key.startsWith(expectedPrefix)) {
      return new RestResponse<ConfirmPhotoResponseDto>().error('잘못된 key prefix', {
        code: RestResponseCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    const entity = this.photoRepo.create({
      id: dto.photoId,
      momentId,
      userId,
      originalKey: dto.key,
    });
    const saved = await this.photoRepo.save(entity);

    // photo-processing 큐에 적재 — sharp 썸네일 3 size + EXIF 추출 (4.5).
    // 실패해도 retry 3회 자동 (BullMQ exponential backoff).
    // photoId를 BullMQ job ID로 사용 — 중복 enqueue 방지 (idempotent).
    await this.photoProcessingQueue.add(
      'process',
      { photoId: saved.id, userId, momentId, originalKey: saved.originalKey },
      {
        jobId: saved.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return new RestResponse<ConfirmPhotoResponseDto>().success(
      {
        id: saved.id,
        momentId: saved.momentId,
        originalKey: saved.originalKey,
        createdAt: saved.createdAt.toISOString(),
      },
      { status: HttpStatus.CREATED },
    );
  }

  /** Moment의 사진 리스트 — 각 사진에 presigned GET URL 동봉. */
  async findPhotosByMomentId(
    userId: string,
    momentId: string,
  ): Promise<RestResponse<GetPhotosResponseDto>> {
    const moment = await this.momentsService.findMomentByIdAndUserId(momentId, userId);
    if (!moment) {
      return new RestResponse<GetPhotosResponseDto>().error('Moment를 찾을 수 없습니다', {
        code: RestResponseCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const photos = await this.photoRepo.find({
      where: { momentId },
      order: { createdAt: 'ASC' },
    });

    const items = await Promise.all(photos.map((photo) => this.toListItemDto(photo)));
    return new RestResponse<GetPhotosResponseDto>().success({ photos: items });
  }

  /** R2 key 형식 강제 — 사용자별 prefix로 cross-user 차단. */
  private buildKey(userId: string, momentId: string, photoId: string, ext: string): string {
    return `user/${userId}/moments/${momentId}/${photoId}.${ext}`;
  }

  /** Photo entity → PhotoListItemDto. presigned GET URL 동봉. */
  private async toListItemDto(photo: Photo): Promise<PhotoListItemDto> {
    const originalUrl = await this.r2Service.createPresignedGetUrl(photo.originalKey);
    return {
      id: photo.id,
      momentId: photo.momentId,
      originalKey: photo.originalKey,
      originalUrl,
      createdAt: photo.createdAt.toISOString(),
    };
  }
}
