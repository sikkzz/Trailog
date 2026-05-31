// photos lib barrel export — 다른 모듈은 항상 이 index에서 import.
//
// 사용:
//   import { uploadPhoto, getMomentPhotos } from '@/lib/photos';
//   import type { PhotoListItem } from '@/lib/photos';

export {
  confirmPhotoUpload,
  createPresignedUploadUrl,
  getMomentPhotos,
  uploadPhoto,
  uploadPhotoToR2,
} from './photos-api';

export type {
  AllowedPhotoExt,
  ConfirmPhotoResponse,
  CreateUploadUrlResponse,
  GetPhotosResponse,
  PhotoListItem,
} from './photos-types';
