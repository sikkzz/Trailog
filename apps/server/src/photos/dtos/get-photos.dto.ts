// GetPhotosResponseDto
// GET /moments/:momentId/photos
//
// Moment의 사진 리스트 반환. 정렬: createdAt ASC (오래된 순 — 시간 흐름 표시).
// 페이지네이션은 Phase 후속.
//
// 각 item:
// - originalUrl: 원본 presigned GET URL (1시간 만료)
// - thumbnailUrls: 3 size 썸네일 presigned GET URL (Phase 2 4.4). 처리 미완료/실패 시 null
// - processingStatus: 'pending'/'done'/'failed' — 모바일 UI 분기 결정
// - takenAt: EXIF DateTimeOriginal (Phase 2 4.5). EXIF 없는 사진은 null
// - location: EXIF GPS {latitude, longitude} (Phase 2 4.5). GPS 없는 사진은 null
//   ↑ DB는 GeoJSON [lng,lat]이지만 API는 모바일 친화 {latitude, longitude} (react-native-maps prop 직매칭)
//
// Phase 후속: CDN(4.7+) 도입 시 URL 정정.

import { ApiProperty } from '@nestjs/swagger';

import type { PhotoProcessingStatus } from '../photo-processing.types';

export class PhotoLocationDto {
  @ApiProperty({
    example: 37.5665,
    description: '위도 (WGS84) — 모바일 지도 핀에 직접 사용',
  })
  latitude!: number;

  @ApiProperty({
    example: 126.978,
    description: '경도 (WGS84)',
  })
  longitude!: number;
}

export class PhotoThumbnailUrlsDto {
  @ApiProperty({
    example: 'https://abc.r2.cloudflarestorage.com/...thumbs/...small.webp?X-Amz-Signature=...',
    description: 'Small (320px width) presigned GET URL — grid 표시용',
  })
  small!: string;

  @ApiProperty({
    example: 'https://abc.r2.cloudflarestorage.com/...thumbs/...medium.webp?X-Amz-Signature=...',
    description: 'Medium (800px width) presigned GET URL — preview용',
  })
  medium!: string;

  @ApiProperty({
    example: 'https://abc.r2.cloudflarestorage.com/...thumbs/...large.webp?X-Amz-Signature=...',
    description: 'Large (1600px width) presigned GET URL — full-screen용',
  })
  large!: string;
}

export class PhotoListItemDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({ example: 'a1b2c3d4-...' })
  momentId!: string;

  @ApiProperty({ example: 'user/abc/moments/xyz/7c8e.jpg' })
  originalKey!: string;

  @ApiProperty({
    example: 'https://abc.r2.cloudflarestorage.com/...?X-Amz-Signature=...',
    description: 'Presigned GET URL (1시간 만료) — 모바일이 그대로 <Image source>',
  })
  originalUrl!: string;

  @ApiProperty({
    type: PhotoThumbnailUrlsDto,
    nullable: true,
    description: '썸네일 3 size presigned GET URL. 처리 미완료/실패 시 null',
  })
  thumbnailUrls!: PhotoThumbnailUrlsDto | null;

  @ApiProperty({
    enum: ['pending', 'done', 'failed'],
    example: 'done',
    description: 'BullMQ 처리 상태 — pending/done/failed. 모바일이 UI 분기 결정',
  })
  processingStatus!: PhotoProcessingStatus;

  @ApiProperty({
    example: '2024-03-15T14:30:00.000Z',
    nullable: true,
    description: 'EXIF DateTimeOriginal (촬영 시각). EXIF 없는 사진/스크린샷은 null',
  })
  takenAt!: string | null;

  @ApiProperty({
    type: PhotoLocationDto,
    nullable: true,
    description: 'EXIF GPS 좌표 (WGS84). GPS 정보 없는 사진은 null',
  })
  location!: PhotoLocationDto | null;

  @ApiProperty({ example: '2026-05-31T12:00:00.000Z' })
  createdAt!: string;
}

export class GetPhotosResponseDto {
  @ApiProperty({ type: [PhotoListItemDto] })
  photos!: PhotoListItemDto[];
}
