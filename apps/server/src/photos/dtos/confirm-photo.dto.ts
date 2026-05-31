// ConfirmPhotoRequestDto / ConfirmPhotoResponseDto
// POST /moments/:momentId/photos
//
// 모바일이 R2 PUT 성공 후 호출 — 백엔드가 Photo row를 DB에 생성.
//
// 학습 포인트:
// - photoId / key는 백엔드가 미리 step 1(/upload-url)에서 발급
// - 모바일이 그대로 박아 보냄 (조작 시도 → 권한 검증으로 차단)
// - 권한: key 시작 prefix `user/{userId}/...` 검증 (cross-user prefix 차단)

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class ConfirmPhotoRequestDto {
  @ApiProperty({ example: '7c8e0f1a-...', description: 'upload-url 발급 시 받은 photoId' })
  @IsUUID()
  photoId!: string;

  @ApiProperty({
    example: 'user/abc/moments/xyz/7c8e.jpg',
    description: 'upload-url 발급 시 받은 key',
  })
  @IsString()
  @Matches(/^user\/[^/]+\/moments\/[^/]+\/[^/]+\.[a-z]+$/, {
    message: 'key 형식 오류 (user/{userId}/moments/{momentId}/{photoId}.{ext})',
  })
  key!: string;
}

export class ConfirmPhotoResponseDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({ example: 'a1b2c3d4-...' })
  momentId!: string;

  @ApiProperty({ example: 'user/abc/moments/xyz/7c8e.jpg' })
  originalKey!: string;

  @ApiProperty({ example: '2026-05-31T12:00:00.000Z' })
  createdAt!: string;
}
