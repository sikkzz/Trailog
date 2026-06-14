// Photo processing 타입 + 썸네일 size 상수.
//
// 썸네일 size 잠정 결정 (메모리 `thumbnail-sizes-revisit`):
// - s 320px: 100x100 grid card 표시용 (Moment 상세 그리드)
// - m 800px: iPhone 일반 폭 @2x ~ 800px (사진 단일 preview)
// - l 1600px: iPhone Pro Max @3x ≈ 1290px → 1600px 여유 (full-screen)
//
// Phase 2 4.6 모바일 화면 디자인 + 실측 후 재검토.

/**
 * Photo 처리 상태 — DB `photos.processing_status` 컬럼 값.
 * - pending: confirm 직후, 아직 큐 작업 대기/진행 중
 * - done: sharp 3 size + (4.5)EXIF 모두 성공
 * - failed: retry 3회 소진 후 실패 (BullMQ onFailed → DB 마킹)
 */
export type PhotoProcessingStatus = 'pending' | 'done' | 'failed';

/**
 * 썸네일 size 키 — small/medium/large.
 * API 응답 contract이므로 한 글자(s/m/l) 회피 — 외부 가독성 우선.
 */
export type ThumbnailSizeKey = 'small' | 'medium' | 'large';

/** Photo entity `thumbnailKeys` jsonb 컬럼 형식. */
export type PhotoThumbnailKeys = Record<ThumbnailSizeKey, string>;

/**
 * PostGIS Point geometry — GeoJSON 형식.
 * coordinates는 [longitude, latitude] 순서 (GeoJSON 표준 — lat/lng 아님 주의).
 */
export interface PhotoLocation {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Worker에서 EXIF 추출 결과 — DB update payload.
 * EXIF 없거나 파싱 실패 시 각 필드 null (사진 자체는 정상 처리).
 */
export interface PhotoExifData {
  takenAt: Date | null;
  location: PhotoLocation | null;
  exifJson: Record<string, unknown> | null;
}

/** Width 기준 (height는 aspect ratio 유지). WebP 변환 quality 함께 정의. */
export const THUMBNAIL_SIZES: Record<ThumbnailSizeKey, { width: number; quality: number }> = {
  small: { width: 320, quality: 80 },
  medium: { width: 800, quality: 85 },
  large: { width: 1600, quality: 90 },
};

/** BullMQ photo-processing 큐 job payload. */
export interface PhotoProcessingJobData {
  photoId: string;
  userId: string;
  momentId: string;
  originalKey: string;
}

/**
 * Job 처리 결과 — DB 업데이트용.
 * key 형식: `user/{userId}/moments/{momentId}/thumbs/{photoId}_{size}.webp`
 *   ({size}는 'small' | 'medium' | 'large')
 */
export interface PhotoProcessingJobResult {
  photoId: string;
  thumbnailKeys: PhotoThumbnailKeys;
}

/** R2 thumbnail key 생성 — 도메인 무관 strict 형식. */
export function buildThumbnailKey(
  userId: string,
  momentId: string,
  photoId: string,
  size: ThumbnailSizeKey,
): string {
  return `user/${userId}/moments/${momentId}/thumbs/${photoId}_${size}.webp`;
}

// =============================================================================
// EXIF strip (Phase 3 5.2) — sharp `withExif()` 기반 lazy 생성
// =============================================================================

/**
 * EXIF strip 정책 — Share 토큰에 박힌 정책에 따라 다른 strip 파일 활용.
 * - all: 모든 EXIF 제거 (sharp default 동작)
 * - gps_only: GPS 키만 제거 + 나머지 EXIF 보존 (사용자 친화 기본값)
 * - none: 원본 그대로 (strip X — Photo.originalKey 활용)
 *
 * `none`은 strip 파일 X — 원본 활용. strip 대상은 `all` / `gps_only`만.
 */
export type ExifStripVariant = 'all' | 'gps_only';

/**
 * Photo entity `stripped_keys` jsonb 컬럼 형식 — variant별 R2 key 박힘.
 * Lazy 생성 — 외부 접근 시점에 strip + R2 PUT + DB update.
 * 둘 다 또는 한쪽만 박힘 가능 (호출된 정책만).
 */
export type PhotoStrippedKeys = Partial<Record<ExifStripVariant, string>>;

/**
 * R2 strip key 생성.
 * 형식: `user/{userId}/moments/{momentId}/stripped/{photoId}_{variant}.{ext}`
 * 원본 확장자 그대로 (jpg/heic 등) — sharp는 출력 포맷 명시 안 하면 입력 포맷 유지.
 */
export function buildStrippedKey(
  userId: string,
  momentId: string,
  photoId: string,
  variant: ExifStripVariant,
  ext: string,
): string {
  return `user/${userId}/moments/${momentId}/stripped/${photoId}_${variant}.${ext}`;
}
