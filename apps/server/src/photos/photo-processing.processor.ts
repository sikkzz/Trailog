// PhotoProcessingProcessor — BullMQ worker. 사진 업로드 직후 background 처리.
//
// 흐름:
//   1. job 받음 ({ photoId, userId, momentId, originalKey })
//   2. R2에서 원본 사진 GET (Buffer)
//   3. sharp로 3 size (s/m/l) WebP 변환 — Promise.all 병렬
//   4. R2에 PUT × 3 (thumbs/ prefix)
//   5. (D3 시점에 Photo.thumbnailUrls 업데이트 + processingStatus 'done')
//
// 실패 처리:
//   - 어느 단계든 throw → BullMQ exponential backoff 재시도 3회
//   - 최종 실패 시 onFailed 핸들러로 알림 (Phase 후속)
//
// 학습 포인트:
//   - sharp는 CPU 무거움 — concurrency 제한 가치 (현재 BullMQ default = 1, 추후 측정 후 정정)
//   - WebP 변환 quality 80~90 — 시각적 손실 작고 사이즈 절감 ↑
//   - Promise.all 3 size 병렬 — 단일 job 안에선 무난 (메모리 임시 상승)

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import sharp from 'sharp';

import { R2Service } from '../r2/r2.service';

import {
  buildThumbnailKey,
  type PhotoProcessingJobData,
  type PhotoProcessingJobResult,
  THUMBNAIL_SIZES,
  type ThumbnailSizeKey,
} from './photo-processing.types';
import { PHOTO_PROCESSING_QUEUE } from './photos.constants';

@Processor(PHOTO_PROCESSING_QUEUE)
export class PhotoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoProcessingProcessor.name);

  constructor(private readonly r2Service: R2Service) {
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

    this.logger.log(`Photo ${photoId} processed successfully (3 thumbs)`);
    return { photoId, thumbnailKeys };
  }
}
