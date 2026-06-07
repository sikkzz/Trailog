// Photos Zod schemas — ADR-0008 적용.
//
// 백엔드 DTO (`apps/server/src/photos/dtos/*`)와 sync:
//   - CreateUploadUrlRequest/Response (POST /moments/:momentId/photos/upload-url)
//   - ConfirmPhotoRequest/Response (POST /moments/:momentId/photos)
//   - GetPhotosResponse + PhotoListItem (GET /moments/:momentId/photos)
//
// Phase 2 4.4 D3c — thumbnailUrls(small/medium/large) + processingStatus 추가
// Phase 2 4.5 D3 — takenAt(ISO|null) + location({latitude, longitude}|null) 추가

import { z } from 'zod';

// =============================================================================
// 보조 schemas
// =============================================================================

export const AllowedPhotoExtSchema = z.enum(['jpg', 'jpeg', 'png', 'heic', 'webp']);
export type AllowedPhotoExt = z.infer<typeof AllowedPhotoExtSchema>;

export const PhotoProcessingStatusSchema = z.enum(['pending', 'done', 'failed']);
export type PhotoProcessingStatus = z.infer<typeof PhotoProcessingStatusSchema>;

export const PhotoThumbnailUrlsSchema = z.object({
  small: z.string(),
  medium: z.string(),
  large: z.string(),
});
export type PhotoThumbnailUrls = z.infer<typeof PhotoThumbnailUrlsSchema>;

export const PhotoLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
export type PhotoLocation = z.infer<typeof PhotoLocationSchema>;

// =============================================================================
// POST /moments/:momentId/photos/upload-url — presigned URL 발급
// =============================================================================

export const CreateUploadUrlRequestSchema = z.object({
  ext: AllowedPhotoExtSchema,
});

export const CreateUploadUrlResponseSchema = z.object({
  photoId: z.string(),
  key: z.string(),
  presignedUrl: z.string(),
  contentType: z.string(),
});

export type CreateUploadUrlRequest = z.infer<typeof CreateUploadUrlRequestSchema>;
export type CreateUploadUrlResponse = z.infer<typeof CreateUploadUrlResponseSchema>;

// =============================================================================
// POST /moments/:momentId/photos — 업로드 완료 알림
// =============================================================================

export const ConfirmPhotoRequestSchema = z.object({
  photoId: z.string(),
  key: z.string(),
});

export const ConfirmPhotoResponseSchema = z.object({
  id: z.string(),
  momentId: z.string(),
  originalKey: z.string(),
  createdAt: z.string(),
});

export type ConfirmPhotoRequest = z.infer<typeof ConfirmPhotoRequestSchema>;
export type ConfirmPhotoResponse = z.infer<typeof ConfirmPhotoResponseSchema>;

// =============================================================================
// GET /moments/:momentId/photos — 사진 리스트 (presigned GET URL 동봉)
// =============================================================================

export const PhotoListItemSchema = z.object({
  id: z.string(),
  momentId: z.string(),
  originalKey: z.string(),
  /** Presigned GET URL (1시간 만료) — 모바일이 <Image source> 그대로 사용 */
  originalUrl: z.string(),
  /** 4.4 — sharp 처리 완료 시 small/medium/large URL. 처리 미완료/실패 시 null */
  thumbnailUrls: PhotoThumbnailUrlsSchema.nullable(),
  processingStatus: PhotoProcessingStatusSchema,
  /** 4.5 — EXIF DateTimeOriginal (ISO 8601). EXIF 없는 사진은 null */
  takenAt: z.string().nullable(),
  /** 4.5 — EXIF GPS {latitude, longitude}. GPS 없는 사진은 null */
  location: PhotoLocationSchema.nullable(),
  createdAt: z.string(),
});

export const GetPhotosResponseSchema = z.object({
  photos: z.array(PhotoListItemSchema),
});

export type PhotoListItem = z.infer<typeof PhotoListItemSchema>;
export type GetPhotosResponse = z.infer<typeof GetPhotosResponseSchema>;

// =============================================================================
// GET /photos/map?bbox=... — 지도 viewport 사진 (Phase 2 4.7 D3a)
// =============================================================================
//
// 응답 구조는 GetPhotosResponse와 동일 (PhotoListItem 배열).
// 단 백엔드에서 processingStatus='done' + location IS NOT NULL 보장.
// 별도 schema/type으로 분리 — 미래 lite response 전환 시점에 자연 변경 자리.

export const GetMapPhotosResponseSchema = z.object({
  photos: z.array(PhotoListItemSchema),
});

export type GetMapPhotosResponse = z.infer<typeof GetMapPhotosResponseSchema>;

/** bbox tuple: `[minLng, minLat, maxLng, maxLat]` — GeoJSON 순서, WGS84/SRID 4326 */
export type Bbox = [number, number, number, number];
