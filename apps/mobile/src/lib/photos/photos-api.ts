// Photos API 클라이언트 — Phase 2 4.3 D5 도입, 4.6 D4 Schema.parse 정정 (ADR-0008).
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
// | 영역             | Web (참조 패턴)                          | Mobile (Trailog)                          |
// | ---------------- | ---------------------------------------- | ----------------------------------------- |
// | 사진 source      | `<input type="file">` + FileReader       | expo-image-picker → uri                   |
// | 업로드 방식      | `fetch(url, { body: blob })`             | `FileSystem.uploadAsync(url, fileUri)`    |
// | progress         | XMLHttpRequest.upload.onprogress         | RN fetch X — FileSystem upload는 progress |
// | CORS             | R2 버킷 CORS 정책 필수                   | 모바일 native fetch — 무관                |
//
// **왜 expo-file-system.uploadAsync**: RN fetch(`file://uri`).blob()는 native에서 종종 crash
// 또는 빈 Blob 반환. RN/Expo 표준 패턴이 `FileSystem.uploadAsync(url, fileUri, BINARY_CONTENT)`
// — native 측 binary 직접 PUT (메모리 효율 + crash 회피).

// SDK 56: uploadAsync는 legacy 경로로 이동 (new API는 UploadTask class).
// 안정 + 단순한 legacy uploadAsync 사용 — 미래 v2 전환 시 정정 (메모리 또는 별도 wave).
import * as FileSystem from 'expo-file-system/legacy';

import { apiRequest } from '../auth';

import {
  ConfirmPhotoResponseSchema,
  CreateUploadUrlResponseSchema,
  GetPhotosResponseSchema,
  type AllowedPhotoExt,
  type ConfirmPhotoResponse,
  type CreateUploadUrlResponse,
  type GetPhotosResponse,
} from './photos-schemas';

/** Step 1 — 백엔드에 presigned PUT URL 요청 */
export async function createPresignedUploadUrl(
  momentId: string,
  ext: AllowedPhotoExt,
): Promise<CreateUploadUrlResponse> {
  const data = await apiRequest(`/moments/${momentId}/photos/upload-url`, {
    method: 'POST',
    body: { ext },
  });
  return CreateUploadUrlResponseSchema.parse(data);
}

/**
 * Step 2 — R2에 직접 PUT (백엔드 안 거침).
 *
 * `expo-file-system.uploadAsync` 사용 — native binary 직접 PUT, RN fetch+blob crash 회피.
 *
 * 주의:
 * - Content-Type은 presigned 발급 시 박은 값과 정확히 일치해야 함 (서명 검증).
 * - fileUri는 expo-image-picker가 반환한 `file://...` 또는 `ph://...` (iOS PHAsset).
 */
export async function uploadPhotoToR2(
  presignedUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const result = await FileSystem.uploadAsync(presignedUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`R2 업로드 실패: ${result.status} ${result.body}`);
  }
}

/** Step 3 — 백엔드에 업로드 완료 알림 + Photo row 생성 */
export async function confirmPhotoUpload(
  momentId: string,
  photoId: string,
  key: string,
): Promise<ConfirmPhotoResponse> {
  const data = await apiRequest(`/moments/${momentId}/photos`, {
    method: 'POST',
    body: { photoId, key },
  });
  return ConfirmPhotoResponseSchema.parse(data);
}

/** Moment의 사진 리스트 (presigned GET URL 동봉, 1시간 만료) */
export async function getMomentPhotos(momentId: string): Promise<GetPhotosResponse> {
  const data = await apiRequest(`/moments/${momentId}/photos`);
  return GetPhotosResponseSchema.parse(data);
}

/**
 * High-level 헬퍼 — 사진 업로드 전체 흐름.
 *
 * 학습 포인트 — 순차 처리 이유:
 * - presigned URL 발급 후 PUT 가능 (의존성)
 * - PUT 성공 후 confirm (R2 실패하면 DB row 안 만듦 → orphan 방지)
 * - Promise.all 사용 X (의존 흐름).
 */
export async function uploadPhoto(
  momentId: string,
  fileUri: string,
  ext: AllowedPhotoExt,
): Promise<ConfirmPhotoResponse> {
  const { photoId, key, presignedUrl, contentType } = await createPresignedUploadUrl(momentId, ext);
  await uploadPhotoToR2(presignedUrl, fileUri, contentType);
  return confirmPhotoUpload(momentId, photoId, key);
}
