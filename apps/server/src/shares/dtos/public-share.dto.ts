// PublicShareResponseDto / UnlockShareRequestDto — Phase 3 5.1 D6b 외부 사용자 endpoint.
//
// 흐름:
//   1. GET /shares/public/:token
//      - 만료/취소: 410/404 (controller에서 throw)
//      - 비밀번호 보호: `{ status: 'locked', expiresAt, exifStripPolicy }` 응답
//      - 정상: `{ status: 'open', target, photo? | moment?, expiresAt, exifStripPolicy }`
//   2. POST /shares/public/:token/unlock { password }
//      - bcrypt 비교 → 통과 시 'open' 응답 (사진 데이터)
//      - 실패: 401
//
// **응답에 비밀번호 자체 노출 X — passwordHash도 X**. 보안 강화.
//
// **target 분기**:
//   - target=photo → photo 필드만 채움 (moment 필드는 null/생략)
//   - target=moment → moment 필드 (photos 배열 포함)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

import { ExifStripPolicy, ShareTarget } from '../share.entity';

/** 공유 받은 사진 단일 — 외부 사용자에게 노출되는 필드만 */
export class PublicPhotoDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({
    example: 'https://r2.cloudflarestorage.com/.../photo.jpg?X-Amz-...',
    description: 'R2 presigned GET URL (15분 유효)',
  })
  imageUrl!: string;

  @ApiPropertyOptional({ example: '2026-04-15T13:25:00.000Z', nullable: true })
  takenAt!: string | null;

  @ApiPropertyOptional({
    example: { latitude: 37.5665, longitude: 126.978 },
    nullable: true,
    description: 'EXIF strip policy=all이면 null로 노출 (5.2 wave에서 본격 적용)',
  })
  location!: { latitude: number; longitude: number } | null;
}

/** 공유 받은 Moment — 외부 사용자에게 노출되는 필드만 */
export class PublicMomentDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({ example: '도쿄 여행' })
  title!: string;

  @ApiPropertyOptional({ example: '2026-04-15T00:00:00.000Z', nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ example: '2026-04-22T00:00:00.000Z', nullable: true })
  endedAt!: string | null;

  @ApiProperty({ type: [PublicPhotoDto], description: 'Moment의 사진들 (presigned URL 포함)' })
  photos!: PublicPhotoDto[];
}

/** GET /shares/public/:token 응답 — status로 분기 */
export class PublicShareResponseDto {
  @ApiProperty({
    enum: ['locked', 'open'],
    description: 'locked = 비밀번호 필요 / open = 데이터 노출',
  })
  status!: 'locked' | 'open';

  @ApiProperty({ enum: ShareTarget, description: '공유 대상 종류' })
  target!: ShareTarget;

  @ApiProperty({ enum: ExifStripPolicy, description: 'EXIF strip 정책 (참고용)' })
  exifStripPolicy!: ExifStripPolicy;

  @ApiPropertyOptional({ example: '2026-06-16T00:00:00.000Z', nullable: true })
  expiresAt!: string | null;

  @ApiPropertyOptional({
    type: PublicPhotoDto,
    description: 'target=photo && status=open일 때만',
    nullable: true,
  })
  photo!: PublicPhotoDto | null;

  @ApiPropertyOptional({
    type: PublicMomentDto,
    description: 'target=moment && status=open일 때만',
    nullable: true,
  })
  moment!: PublicMomentDto | null;
}

/** POST /shares/public/:token/unlock request */
export class UnlockShareRequestDto {
  @ApiProperty({ example: 'secret123', minLength: 4 })
  @IsString()
  @MinLength(4, { message: '비밀번호는 4자 이상이어야 합니다' })
  password!: string;
}
