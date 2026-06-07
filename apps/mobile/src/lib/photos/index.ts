// photos lib barrel export.

export {
  confirmPhotoUpload,
  createPresignedUploadUrl,
  fetchMapPhotos,
  getMomentPhotos,
  uploadPhoto,
  uploadPhotoToR2,
} from './photos-api';

export { photosKeys, useMapPhotos, useMomentPhotos, useUploadPhoto } from './photos-queries';

export {
  AllowedPhotoExtSchema,
  ConfirmPhotoRequestSchema,
  ConfirmPhotoResponseSchema,
  CreateUploadUrlRequestSchema,
  CreateUploadUrlResponseSchema,
  GetMapPhotosResponseSchema,
  GetPhotosResponseSchema,
  PhotoListItemSchema,
  PhotoLocationSchema,
  PhotoProcessingStatusSchema,
  PhotoThumbnailUrlsSchema,
} from './photos-schemas';

export type {
  AllowedPhotoExt,
  Bbox,
  ConfirmPhotoRequest,
  ConfirmPhotoResponse,
  CreateUploadUrlRequest,
  CreateUploadUrlResponse,
  GetMapPhotosResponse,
  GetPhotosResponse,
  PhotoListItem,
  PhotoLocation,
  PhotoProcessingStatus,
  PhotoThumbnailUrls,
} from './photos-schemas';
