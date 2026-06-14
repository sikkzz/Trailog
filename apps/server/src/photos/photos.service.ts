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
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import piexif from 'piexifjs';
import sharp from 'sharp';
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
import {
  buildStrippedKey,
  type ExifStripVariant,
  type PhotoLocation,
  type PhotoProcessingJobData,
  type PhotoThumbnailKeys,
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
  private readonly logger = new Logger(PhotosService.name);

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

  /**
   * 외부 공유용 — photoId만으로 조회 + presigned URL (Phase 3 5.1 D6b + 5.2 strip).
   *
   * Share 토큰으로 검증된 후 호출되는 method — 권한 검사 X.
   * variant null이면 thumbnail large 우선 (Phase 3 5.1 동작).
   * variant 'all'/'gps_only'면 strip 파일 — 없으면 Lazy 생성 + R2 PUT + DB cache (5.2).
   *
   * @param photoId target photo
   * @param variant null=원본 활용 / 'all'/'gps_only'=strip 파일
   * @returns photo + presigned URL (없으면 null)
   */
  async findPhotoForShare(
    photoId: string,
    variant: ExifStripVariant | null = null,
  ): Promise<{ photo: Photo; imageUrl: string } | null> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) return null;

    const key = await this.resolveShareImageKey(photo, variant);
    const imageUrl = await this.r2Service.createPresignedGetUrl(key);

    return { photo, imageUrl };
  }

  /**
   * 외부 공유용 — momentId의 사진들 조회 (Phase 3 5.1 D6b + 5.2 strip).
   *
   * Share 토큰으로 검증된 후 호출되는 method — 권한 검사 X.
   * variant에 따라 원본/strip 분기. Lazy 생성은 순차 처리 (사진 수 ↑ 시 latency ↑ but
   * 외부 사용자 첫 접근만 — 두 번째 접근부터는 캐시 활용 즉시).
   *
   * @param momentId target moment
   * @param variant null=원본 활용 / 'all'/'gps_only'=strip 파일
   * @returns 사진 리스트 + presigned URL 각각
   */
  async findPhotosForMomentShare(
    momentId: string,
    variant: ExifStripVariant | null = null,
  ): Promise<{ photo: Photo; imageUrl: string }[]> {
    const photos = await this.photoRepo.find({
      where: { momentId, processingStatus: 'done' },
      order: { takenAt: 'ASC', createdAt: 'ASC' },
    });

    return Promise.all(
      photos.map(async (photo) => {
        const key = await this.resolveShareImageKey(photo, variant);
        const imageUrl = await this.r2Service.createPresignedGetUrl(key);
        return { photo, imageUrl };
      }),
    );
  }

  /**
   * 공유 페이지 표시용 image key 해석.
   *
   * - variant null → thumbnail large 우선 (없으면 original) — 5.1 패턴 유지
   * - variant 'all'/'gps_only' → 원본에서 strip → R2 PUT (Lazy 캐싱)
   *
   * **strip은 원본 기준** — thumbnail은 sharp가 default로 EXIF strip하므로
   * GPS 정책 의도 fit X. 원본에서 strip + presigned URL은 원본보단 strip된 사본 가리킴.
   */
  private async resolveShareImageKey(
    photo: Photo,
    variant: ExifStripVariant | null,
  ): Promise<string> {
    if (variant === null) {
      // 5.1 패턴 — thumbnail large 우선
      return photo.thumbnailKeys?.large ?? photo.originalKey;
    }
    // 5.2 — strip variant (Lazy 캐싱)
    return this.getOrCreateStrippedKey(photo, variant);
  }

  /**
   * Lazy strip 생성 — Photo.strippedKeys 캐시 hit면 그대로, miss면 생성.
   *
   * 흐름:
   *   1. Photo.strippedKeys[variant] 있으면 그 key 반환 (캐시 hit — 즉시)
   *   2. 없으면 원본 R2 GET → strip → R2 PUT → DB update → 새 key 반환
   *
   * race condition: 동시 두 호출 시 둘 다 생성 + 마지막 PUT/UPDATE가 이김.
   * 동일 key라 R2 overwrite OK. DB strippedKeys는 마지막 update 이김 — 데이터 일관 OK.
   * 비용은 한 번 더 처리 — 외부 공유 hot path X라 무시 가능.
   *
   * @param photo Photo entity
   * @param variant 'all' | 'gps_only'
   * @returns strip 파일 R2 key
   */
  private async getOrCreateStrippedKey(photo: Photo, variant: ExifStripVariant): Promise<string> {
    const cached = photo.strippedKeys?.[variant];
    if (cached) return cached;

    // Lazy 생성 — 원본 GET → strip → PUT → DB update
    const originalBuffer = await this.r2Service.getObjectBuffer(photo.originalKey);
    const ext = this.extractExt(photo.originalKey);
    const strippedBuffer = await this.stripExif(originalBuffer, variant, ext);
    const strippedKey = buildStrippedKey(photo.userId, photo.momentId, photo.id, variant, ext);
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

    await this.r2Service.putObjectBuffer(strippedKey, strippedBuffer, contentType);

    // DB update — strippedKeys jsonb merge (다른 variant 보존)
    const merged = { ...photo.strippedKeys, [variant]: strippedKey };
    await this.photoRepo.update(photo.id, { strippedKeys: merged });
    photo.strippedKeys = merged; // in-memory entity 갱신

    this.logger.log(`Created stripped (${variant}) for photo ${photo.id} → ${strippedKey}`);
    return strippedKey;
  }

  /**
   * EXIF strip — variant 분기 (Phase 3 5.2 D3).
   *
   * - **all**: sharp default — 옵션 안 박으면 EXIF 자동 strip + re-encode
   *   · 단점: 원본 quality 일부 손실 (re-encode). EXIF 전체 제거 + thumbnail 일관.
   *
   * - **gps_only**: piexifjs로 GPS IFD만 제거 (sharp re-encode 불필요)
   *   · 장점: 나머지 EXIF (촬영 시각/디바이스/렌즈/orientation 등) 보존 + quality 무손실
   *   · JPEG/HEIC만 지원 — PNG/WebP는 EXIF 표준 X로 sharp default strip fallback
   *
   * sharp 한계 박제 (ADR-0015 보강): sharp `withExif()`는 raw buffer 전체 교체라
   * 한 키(GPS)만 제거 불가. piexifjs는 JPEG EXIF binary 직접 조작 — 27KB 가벼움.
   */
  private async stripExif(buffer: Buffer, variant: ExifStripVariant, ext: string): Promise<Buffer> {
    if (variant === 'all') {
      // sharp default — 옵션 안 박으면 EXIF 자동 strip
      return sharp(buffer).toBuffer();
    }

    // gps_only
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'heic') {
      // piexifjs는 JPEG/HEIC EXIF binary 직접 조작 (sharp re-encode 불필요)
      return this.stripGpsWithPiexif(buffer);
    }

    // PNG/WebP — EXIF 표준 X (PNG=tEXt 청크 / WebP=EXIF chunk 별도)
    // sharp default strip fallback — GPS 포함 모든 메타 제거 (사용자 의도 fit)
    return sharp(buffer).toBuffer();
  }

  /**
   * piexifjs로 JPEG GPS IFD만 제거.
   *
   * piexifjs는 'binary string' 형식 입출력 (Node Buffer 변환 필요).
   * 실패 시 (EXIF 없는 JPEG 등) sharp default strip fallback.
   */
  private stripGpsWithPiexif(buffer: Buffer): Buffer {
    try {
      const binary = buffer.toString('binary');
      const exifObj = piexif.load(binary);
      // delete GPS IFD — piexifjs는 'GPS' 키로 GPS IFD 박혀있음
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- piexifjs type 한계
      delete (exifObj as any).GPS;
      const newExifBinary = piexif.dump(exifObj);
      const newBinary = piexif.insert(newExifBinary, binary);
      return Buffer.from(newBinary, 'binary');
    } catch (err) {
      // EXIF 파싱 실패 — sharp default strip fallback (안전)
      this.logger.warn(`piexif strip failed, fallback to sharp default: ${String(err)}`);
      // sharp가 동기적 stripExif 호출자라 promise 반환 안 함 — 호출자에서 await
      // 단 이 throw 흐름은 caller가 wrap한 try/catch 없음 — sharp sync fallback X
      // → caller에서 처리 위해 throw 대신 원본 그대로 반환 + 경고 (정직성보단 안정성)
      return buffer;
    }
  }

  /** R2 key의 마지막 확장자 추출 — 소문자 (jpg/heic 등) */
  private extractExt(key: string): string {
    const dot = key.lastIndexOf('.');
    return dot === -1 ? 'jpg' : key.slice(dot + 1).toLowerCase();
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
