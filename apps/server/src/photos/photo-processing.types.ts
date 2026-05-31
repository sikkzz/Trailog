// Photo processing 타입 + 썸네일 size 상수.
//
// 썸네일 size 잠정 결정 (메모리 `thumbnail-sizes-revisit`):
// - s 320px: 100x100 grid card 표시용 (Moment 상세 그리드)
// - m 800px: iPhone 일반 폭 @2x ~ 800px (사진 단일 preview)
// - l 1600px: iPhone Pro Max @3x ≈ 1290px → 1600px 여유 (full-screen)
//
// Phase 2 4.6 모바일 화면 디자인 + 실측 후 재검토.

export type ThumbnailSizeKey = 's' | 'm' | 'l';

/** Width 기준 (height는 aspect ratio 유지). WebP 변환 quality 함께 정의. */
export const THUMBNAIL_SIZES: Record<ThumbnailSizeKey, { width: number; quality: number }> = {
  s: { width: 320, quality: 80 },
  m: { width: 800, quality: 85 },
  l: { width: 1600, quality: 90 },
};

/** BullMQ photo-processing 큐 job payload. */
export interface PhotoProcessingJobData {
  photoId: string;
  userId: string;
  momentId: string;
  originalKey: string;
}

/**
 * Job 처리 결과 — DB 업데이트용 (Phase 4.4 D3에 Photo entity 보강 시 사용).
 * key 형식: `user/{userId}/moments/{momentId}/thumbs/{photoId}_{size}.webp`
 */
export interface PhotoProcessingJobResult {
  photoId: string;
  thumbnailKeys: Record<ThumbnailSizeKey, string>;
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
