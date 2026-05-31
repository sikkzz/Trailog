// Photos API 클라이언트 — Phase 2 4.3 D5.
//
// 사진 업로드 흐름 (백엔드 안 거치고 R2 직접 PUT):
//
//   1. createPresignedUploadUrl  → 백엔드가 photoId/key 생성 + presigned PUT URL 발급 (5분)
//   2. uploadPhotoToR2           → 모바일이 R2에 직접 PUT (백엔드 트래픽 0)
//   3. confirmPhotoUpload        → 백엔드에 완료 알림 + Photo row 생성
//
//   high-level: uploadPhoto() 하나로 1~3 한 번에.
//
// =============================================================================
// 참조 프론트(참조 프론트) 비교 — Web ↔ Mobile 차이
// =============================================================================
//
// | 영역             | Web (참조 패턴)                    | Mobile (Trailog)              |
// | ---------------- | ---------------------------------- | ----------------------------- |
// | 사진 source      | `<input type="file">` + FileReader | expo-image-picker → uri       |
// | Blob 생성        | File 객체 자체가 Blob              | fetch(uri).blob() 또는 native |
// | upload progress  | XMLHttpRequest.upload.onprogress   | fetch에 progress X — XHR 검토 |
// | CORS             | R2 버킷 CORS 정책 필수             | 모바일 native fetch — 무관    |
// | timeout          | 보통 30s ~ 60s                     | RN fetch default 무한 — 명시  |
//
// → 모바일은 Blob 만들기/progress 패턴이 약간 다름. fetch progress 필요 시
//   Phase 4.6에 react-native-blob-util 또는 XMLHttpRequest 검토.
//
// =============================================================================

import { apiRequest } from '../auth';

import type {
  AllowedPhotoExt,
  ConfirmPhotoResponse,
  CreateUploadUrlResponse,
  GetPhotosResponse,
} from './photos-types';

/** Step 1 — 백엔드에 presigned PUT URL 요청 */
export async function createPresignedUploadUrl(
  momentId: string,
  ext: AllowedPhotoExt,
): Promise<CreateUploadUrlResponse> {
  return apiRequest<CreateUploadUrlResponse>(`/moments/${momentId}/photos/upload-url`, {
    method: 'POST',
    body: { ext },
  });
}

/**
 * Step 2 — R2에 직접 PUT (백엔드 안 거침).
 *
 * 주의:
 * - Content-Type은 presigned 발급 시 박은 값과 정확히 일치해야 함 (서명 검증).
 * - 일치 안 하면 403 (CFR2 SignatureDoesNotMatch).
 * - blob: Phase 2 4.6에서 expo-image-picker uri → blob 변환 패턴 결정.
 */
export async function uploadPhotoToR2(
  presignedUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`R2 업로드 실패: ${response.status} ${response.statusText}`);
  }
}

/** Step 3 — 백엔드에 업로드 완료 알림 + Photo row 생성 */
export async function confirmPhotoUpload(
  momentId: string,
  photoId: string,
  key: string,
): Promise<ConfirmPhotoResponse> {
  return apiRequest<ConfirmPhotoResponse>(`/moments/${momentId}/photos`, {
    method: 'POST',
    body: { photoId, key },
  });
}

/** Moment의 사진 리스트 (presigned GET URL 동봉, 1시간 만료) */
export async function getMomentPhotos(momentId: string): Promise<GetPhotosResponse> {
  return apiRequest<GetPhotosResponse>(`/moments/${momentId}/photos`);
}

/**
 * High-level 헬퍼 — 사진 업로드 전체 흐름.
 *
 * 사용 (Phase 2 4.6 화면에서):
 *   const photo = await uploadPhoto(momentId, blob, 'jpg');
 *   // photo: { id, momentId, originalKey, createdAt }
 *
 * 학습 포인트 — 순차 처리 이유:
 * - presigned URL 발급 후 PUT 가능 (의존성)
 * - PUT 성공 후 confirm (R2 실패하면 DB row 안 만듦 → orphan 방지)
 * - Promise.all 사용 X (의존 흐름).
 */
export async function uploadPhoto(
  momentId: string,
  blob: Blob,
  ext: AllowedPhotoExt,
): Promise<ConfirmPhotoResponse> {
  const { photoId, key, presignedUrl, contentType } = await createPresignedUploadUrl(momentId, ext);
  await uploadPhotoToR2(presignedUrl, blob, contentType);
  return confirmPhotoUpload(momentId, photoId, key);
}
