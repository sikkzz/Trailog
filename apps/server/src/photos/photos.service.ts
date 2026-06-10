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
import { GetMapPhotosResponseDto } from './dtos/get-map-photos.dto';
import {
  GetPhotosResponseDto,
  PhotoListItemDto,
  PhotoLocationDto,
  PhotoThumbnailUrlsDto,
} from './dtos/get-photos.dto';
import { Photo } from './photo.entity';
import type {
  PhotoLocation,
  PhotoProcessingJobData,
  PhotoThumbnailKeys,
} from './photo-processing.types';
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

  /**
   * 본인 userId의 photo 1건 조회 (권한 검증용) — Phase 3 5.1 추가.
   * 다른 도메인(Shares 등)에서 photoId 권한 확인 시 호출.
   * 본인 것이 아니면 null → 호출자가 NOT_FOUND 또는 FORBIDDEN 응답.
   *
   * MomentsService.findMomentByIdAndUserId 패턴 일관.
   */
  async findPhotoByIdAndUserId(id: string, userId: string): Promise<Photo | null> {
    return this.photoRepo.findOne({ where: { id, userId } });
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

  /**
   * 지도 viewport 안 본인 사진 — PostGIS bbox 쿼리.
   *
   * 필터:
   * - 본인 사진만 (userId)
   * - processingStatus='done' — 썸네일 + EXIF 처리 완료된 것만 (pin 표시 가치 ↑)
   * - bbox: `ST_Within(location, ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326))`
   *   - SRID 4326 = WGS84 (Photo entity location 컬럼과 동일)
   *   - GIST 인덱스 자동 활용 (Photo entity @Index({spatial:true}))
   *   - location IS NULL은 ST_Within이 자동으로 거름
   * - takenAt DESC — 최근 촬영 순 (같은 viewport에 사진 많으면 최근 것 우선)
   *
   * **Phase 후속**:
   * - lite response (id/lat/lng/thumbnailUrl small만) — 사진 1000+ viewport 시 payload 절약
   * - cluster 백엔드 처리 (ST_ClusterDBSCAN) — 사진 수천+ 시 zoom level별 cluster
   */
  async findPhotosByBbox(
    userId: string,
    bbox: [number, number, number, number],
  ): Promise<RestResponse<GetMapPhotosResponseDto>> {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const photos = await this.photoRepo
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .andWhere('p.processingStatus = :status', { status: 'done' })
      .andWhere(
        'ST_Within(p.location, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))',
        { minLng, minLat, maxLng, maxLat },
      )
      .orderBy('p.takenAt', 'DESC')
      .getMany();

    const items = await Promise.all(photos.map((photo) => this.toListItemDto(photo)));
    return new RestResponse<GetMapPhotosResponseDto>().success({ photos: items });
  }

  /** R2 key 형식 강제 — 사용자별 prefix로 cross-user 차단. */
  private buildKey(userId: string, momentId: string, photoId: string, ext: string): string {
    return `user/${userId}/moments/${momentId}/${photoId}.${ext}`;
  }

  /**
   * Photo entity → PhotoListItemDto.
   * - originalUrl: 항상 발급
   * - thumbnailUrls: thumbnailKeys 있으면 3 size 병렬 발급, 없으면 null
   * - processingStatus: 모바일 UI 분기용
   * - takenAt: EXIF 촬영 시각 ISO string (null 가능)
   * - location: GeoJSON [lng,lat] → DTO {latitude, longitude} (null 가능)
   */
  private async toListItemDto(photo: Photo): Promise<PhotoListItemDto> {
    const originalUrl = await this.r2Service.createPresignedGetUrl(photo.originalKey);
    const thumbnailUrls = photo.thumbnailKeys
      ? await this.buildThumbnailUrls(photo.thumbnailKeys)
      : null;
    return {
      id: photo.id,
      momentId: photo.momentId,
      originalKey: photo.originalKey,
      originalUrl,
      thumbnailUrls,
      processingStatus: photo.processingStatus,
      takenAt: photo.takenAt?.toISOString() ?? null,
      location: photo.location ? this.toLocationDto(photo.location) : null,
      createdAt: photo.createdAt.toISOString(),
    };
  }

  /** 썸네일 3 size presigned GET URL 병렬 발급 — Promise.all로 대기 시간 단축. */
  private async buildThumbnailUrls(keys: PhotoThumbnailKeys): Promise<PhotoThumbnailUrlsDto> {
    const [small, medium, large] = await Promise.all([
      this.r2Service.createPresignedGetUrl(keys.small),
      this.r2Service.createPresignedGetUrl(keys.medium),
      this.r2Service.createPresignedGetUrl(keys.large),
    ]);
    return { small, medium, large };
  }

  /** GeoJSON Point → API 친화 {latitude, longitude} (모바일 지도 lib prop 직매칭). */
  private toLocationDto(location: PhotoLocation): PhotoLocationDto {
    const [longitude, latitude] = location.coordinates;
    return { latitude, longitude };
  }
}
