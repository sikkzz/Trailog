// GetPhotosResponseDto
// GET /moments/:momentId/photos
//
// Moment의 사진 리스트 반환. 정렬: createdAt ASC (오래된 순 — 시간 흐름 표시).
// 페이지네이션은 Phase 후속.
//
// 각 item에 presignedGetUrl 포함 — 모바일이 그대로 표시 가능 (1시간 만료).
// Phase 후속: 썸네일(4.4) + CDN(4.7+) 도입 시 URL 정정.

import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: '2026-05-31T12:00:00.000Z' })
  createdAt!: string;
}

export class GetPhotosResponseDto {
  @ApiProperty({ type: [PhotoListItemDto] })
  photos!: PhotoListItemDto[];
}
