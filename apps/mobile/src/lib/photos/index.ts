// photos lib barrel export.

export {
  confirmPhotoUpload,
  createPresignedUploadUrl,
  getMomentPhotos,
  uploadPhoto,
  uploadPhotoToR2,
} from './photos-api';

export { photosKeys, useMomentPhotos, useUploadPhoto } from './photos-queries';

export {
  AllowedPhotoExtSchema,
  ConfirmPhotoRequestSchema,
  ConfirmPhotoResponseSchema,
  CreateUploadUrlRequestSchema,
  CreateUploadUrlResponseSchema,
  GetPhotosResponseSchema,
  PhotoListItemSchema,
  PhotoLocationSchema,
  PhotoProcessingStatusSchema,
  PhotoThumbnailUrlsSchema,
} from './photos-schemas';

export type {
  AllowedPhotoExt,
  ConfirmPhotoRequest,
  ConfirmPhotoResponse,
  CreateUploadUrlRequest,
  CreateUploadUrlResponse,
  GetPhotosResponse,
  PhotoListItem,
  PhotoLocation,
  PhotoProcessingStatus,
  PhotoThumbnailUrls,
} from './photos-schemas';
