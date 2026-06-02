// PhotoProcessingProcessor — BullMQ worker. 사진 업로드 직후 background 처리.
//
// 흐름:
//   1. job 받음 ({ photoId, userId, momentId, originalKey })
//   2. R2에서 원본 사진 GET (Buffer)
//   3. sharp로 3 size (small/medium/large) WebP 변환 — sequential
//   4. R2에 PUT × 3 (thumbs/ prefix)
//   5. EXIF 추출 (Phase 2 4.5) — takenAt + GPS location + 원본 EXIF 보존
//   6. DB update — thumbnailKeys + processingStatus='done' + EXIF 필드들
//
// 실패 처리:
//   - sharp/R2 단계 throw → BullMQ exponential backoff 재시도 3회 (최종 실패 시 'failed')
//   - EXIF 추출 실패는 throw X — null로 박고 사진 자체는 done (EXIF 없는 사진/스크린샷 정상)
//
// 학습 포인트:
//   - EXIF DateTimeOriginal은 'YYYY:MM:DD HH:MM:SS' 형식 (':' 구분자) — 직접 ISO 변환 필요
//   - EXIF GPS는 rational(분/초)인데 exifreader가 decimal로 변환해줌 (expanded mode)
//   - timezone offset 정보가 EXIF에 없을 수 있음 (구형 폰) — local time 해석 (촬영지 기준)

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import ExifReader from 'exifreader';
import sharp from 'sharp';
import { Repository } from 'typeorm';

import { R2Service } from '../r2/r2.service';

import { Photo } from './photo.entity';
import {
  buildThumbnailKey,
  type PhotoExifData,
  type PhotoLocation,
  type PhotoProcessingJobData,
  type PhotoProcessingJobResult,
  THUMBNAIL_SIZES,
  type ThumbnailSizeKey,
} from './photo-processing.types';
import { PHOTO_PROCESSING_QUEUE } from './photos.constants';

@Processor(PHOTO_PROCESSING_QUEUE)
export class PhotoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoProcessingProcessor.name);

  constructor(
    private readonly r2Service: R2Service,
    @InjectRepository(Photo)
    private readonly photoRepo: Repository<Photo>,
  ) {
    super();
  }

  async process(job: Job<PhotoProcessingJobData>): Promise<PhotoProcessingJobResult> {
    const { photoId, userId, momentId, originalKey } = job.data;
    this.logger.log(`Processing photo ${photoId} (attempt ${job.attemptsMade + 1})`);

    const originalBuffer = await this.r2Service.getObjectBuffer(originalKey);
    const sizeKeys = Object.keys(THUMBNAIL_SIZES) as ThumbnailSizeKey[];

    const thumbnailKeys = await sizeKeys.reduce(
      async (accPromise, sizeKey) => {
        const acc = await accPromise;
        const { width, quality } = THUMBNAIL_SIZES[sizeKey];
        const thumbBuffer = await sharp(originalBuffer)
          .rotate() // EXIF orientation 자동 적용 (4.5에서 활용)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
        const key = buildThumbnailKey(userId, momentId, photoId, sizeKey);
        await this.r2Service.putObjectBuffer(key, thumbBuffer, 'image/webp');
        acc[sizeKey] = key;
        return acc;
      },
      Promise.resolve({} as Record<ThumbnailSizeKey, string>),
    );

    // EXIF 추출 — 실패해도 throw X (사진 자체는 정상 처리)
    const exifData = this.extractExif(originalBuffer, photoId);

    // DB 반영 — 처리 완료 표시 + 썸네일 key + EXIF 필드 박제.
    // exifJson은 `as never` cast — TypeORM update가 jsonb의 Record<string, unknown>을
    // _QueryDeepPartialEntity로 deep 풀어버리는 type 한계 회피.
    // 실제 직렬화/저장은 TypeORM이 안전하게 처리 (jsonb 컬럼이 객체 그대로 받음).
    await this.photoRepo.update(photoId, {
      thumbnailKeys,
      processingStatus: 'done',
      takenAt: exifData.takenAt,
      location: exifData.location,
      exifJson: exifData.exifJson as never,
    });

    this.logger.log(
      `Photo ${photoId} processed (3 thumbs, takenAt=${exifData.takenAt?.toISOString() ?? 'null'}, location=${exifData.location ? 'yes' : 'null'})`,
    );
    return { photoId, thumbnailKeys };
  }

  /**
   * 원본 사진 Buffer에서 EXIF metadata 추출.
   * - takenAt: EXIF DateTimeOriginal (없으면 DateTime fallback). 'YYYY:MM:DD HH:MM:SS' → Date 변환
   * - location: EXIF GPS Latitude/Longitude → PostGIS Point GeoJSON
   * - exifJson: 원본 expanded EXIF (디버깅 + 미래 활용)
   * 실패 시 모든 필드 null 반환 (사진 자체는 정상으로 간주).
   */
  private extractExif(buffer: Buffer, photoId: string): PhotoExifData {
    try {
      const tags = ExifReader.load(buffer, { expanded: true, async: false });

      const dateTimeString =
        tags.exif?.DateTimeOriginal?.description ?? tags.exif?.DateTime?.description ?? null;
      const takenAt = dateTimeString ? this.parseExifDateTime(dateTimeString) : null;

      const lat = tags.gps?.Latitude;
      const lng = tags.gps?.Longitude;
      const location: PhotoLocation | null =
        typeof lat === 'number' && typeof lng === 'number'
          ? { type: 'Point', coordinates: [lng, lat] } // GeoJSON: [longitude, latitude]
          : null;

      // exifJson에는 expanded 전체 보존 (큰 객체지만 사진당 ~5KB)
      const exifJson = tags as unknown as Record<string, unknown>;

      return { takenAt, location, exifJson };
    } catch (error) {
      // EXIF 없는 사진(스크린샷), 깨진 metadata 등 — null로 박고 진행
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Photo ${photoId} EXIF 추출 실패 (사진 자체는 정상 처리): ${message}`);
      return { takenAt: null, location: null, exifJson: null };
    }
  }

  /**
   * EXIF DateTime 'YYYY:MM:DD HH:MM:SS' → Date.
   * EXIF엔 timezone 정보 없는 경우 많음 — local time으로 해석 (촬영지 기준).
   * 미래 OffsetTimeOriginal 활용 시 정확도 ↑ (학습 노트 4.5).
   */
  private parseExifDateTime(s: string): Date | null {
    // 'YYYY:MM:DD HH:MM:SS' → 'YYYY-MM-DDTHH:MM:SS'
    const isoLike = s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * BullMQ 실패 이벤트 — 매 실패 시도마다 호출됨 (retry 중간 포함).
   * 최종 실패 (attempts 모두 소진) 시에만 DB를 'failed'로 마킹.
   * 중간 실패는 자동 retry에 맡김 (status='pending' 유지).
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<PhotoProcessingJobData>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(
        `Photo ${job.data.photoId} 처리 실패 — retry ${job.attemptsMade}/${maxAttempts}`,
      );
      return;
    }

    this.logger.error(
      `Photo ${job.data.photoId} 처리 최종 실패 (${job.attemptsMade}회 시도): ${job.failedReason}`,
    );
    await this.photoRepo.update(job.data.photoId, {
      processingStatus: 'failed',
    });
  }
}
