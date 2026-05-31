// CreateUploadUrlRequestDto / CreateUploadUrlResponseDto
// POST /moments/:momentId/photos/upload-url
//
// 흐름:
// 1. 모바일이 ext + ContentType 보냄
// 2. 백엔드가 photoId(uuid) + key 생성 + presigned PUT URL 발급 (5분 만료)
// 3. 응답: { photoId, key, presignedUrl, contentType }
// 4. 모바일이 R2에 직접 PUT (Content-Type 정확히 일치)
// 5. 모바일이 POST /moments/:momentId/photos 호출 (key 박아 완료 알림)

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'] as const;
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export class CreateUploadUrlRequestDto {
  @ApiProperty({
    example: 'jpg',
    enum: ALLOWED_EXTENSIONS,
    description: '확장자 (소문자) — JPEG/PNG/HEIC/WebP만 허용',
  })
  @IsString()
  @IsIn([...ALLOWED_EXTENSIONS], { message: '허용 확장자: jpg/jpeg/png/heic/webp' })
  ext!: AllowedExtension;
}

export class CreateUploadUrlResponseDto {
  @ApiProperty({ example: '7c8e0f1a-...', description: '생성된 photo id (모바일이 추적용)' })
  photoId!: string;

  @ApiProperty({
    example: 'user/abc/moments/xyz/7c8e.jpg',
    description: 'R2 객체 key (모바일은 직접 사용 X, 단순 메타)',
  })
  key!: string;

  @ApiProperty({
    example: 'https://abc.r2.cloudflarestorage.com/...?X-Amz-Signature=...',
    description: 'Presigned PUT URL (5분 만료) — 모바일이 이 URL에 직접 PUT',
  })
  presignedUrl!: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'PUT 시 정확히 박아야 할 Content-Type (서명 검증)',
  })
  contentType!: string;
}
