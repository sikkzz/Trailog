// Photos API 응답 타입 — 백엔드 (apps/server/src/photos/dtos/*) 형식과 sync.
//
// 향후 (Phase 2 4.6): packages/shared-types 도입 시 백엔드 DTO에서 자동 생성.
// 현재는 수동 sync (룰 type-safety.md의 "백엔드 DTO와 단일 출처" 섹션 참고).

export type AllowedPhotoExt = 'jpg' | 'jpeg' | 'png' | 'heic' | 'webp';

export interface CreateUploadUrlResponse {
  photoId: string;
  key: string;
  presignedUrl: string;
  contentType: string;
}

export interface ConfirmPhotoResponse {
  id: string;
  momentId: string;
  originalKey: string;
  createdAt: string;
}

export interface PhotoListItem {
  id: string;
  momentId: string;
  originalKey: string;
  /** Presigned GET URL (1시간 만료) — 모바일이 <Image source> 그대로 사용 */
  originalUrl: string;
  createdAt: string;
}

export interface GetPhotosResponse {
  photos: PhotoListItem[];
}
