// CreateShareRequestDto / CreateShareResponseDto — POST /shares.
//
// 학습 포인트:
// - target enum 검증 (@IsEnum) — string 값이 ShareTarget enum에 속하는지
// - password 입력은 optional + minLength 4 (간단 검증). 백엔드에서 bcrypt 해시 후 저장
// - hasPassword: boolean 응답 — 응답에 password 자체는 노출 X (보안)
// - shareUrl: 클라이언트가 바로 공유할 수 있는 완성된 URL (trailog.app/s/{token})
//   - Phase 3 5.1엔 환경변수 SHARE_BASE_URL로 도메인 박힘 (기본 'http://localhost:3000/s')

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ExifStripPolicy, ShareTarget } from '../share.entity';

export class CreateShareRequestDto {
  @ApiProperty({
    enum: ShareTarget,
    example: ShareTarget.PHOTO,
    description: '공유 대상 종류 — photo(단일 사진) 또는 moment(Moment 전체)',
  })
  @IsEnum(ShareTarget, { message: 'target은 photo 또는 moment여야 합니다' })
  target!: ShareTarget;

  @ApiProperty({
    example: '7c8e0f1a-...',
    description: 'target=photo면 photo.id, target=moment면 moment.id (본인 소유 검증)',
  })
  @IsUUID('4', { message: 'targetId는 UUID v4 형식이어야 합니다' })
  targetId!: string;

  @ApiPropertyOptional({
    example: '2026-06-16T00:00:00Z',
    description: 'ISO 8601 — 만료 시각 (선택, null/미지정 = 영구)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'expiresAt은 ISO 8601 형식이어야 합니다' })
  expiresAt?: string;

  @ApiPropertyOptional({
    example: 'secret123',
    minLength: 4,
    maxLength: 100,
    description: '비밀번호 보호 (선택). 백엔드 bcrypt 해시 후 저장. 4~100자',
  })
  @IsOptional()
  @IsString()
  @MinLength(4, { message: '비밀번호는 4자 이상이어야 합니다' })
  @MaxLength(100, { message: '비밀번호는 100자 이하여야 합니다' })
  password?: string;

  @ApiPropertyOptional({
    enum: ExifStripPolicy,
    example: ExifStripPolicy.GPS_ONLY,
    description: 'EXIF strip 정책 — 5.2 wave에서 본격 활용. 미지정 시 gps_only',
  })
  @IsOptional()
  @IsEnum(ExifStripPolicy, { message: 'exifStripPolicy는 all/gps_only/none 중 하나여야 합니다' })
  exifStripPolicy?: ExifStripPolicy;
}

export class CreateShareResponseDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({ example: 'V1StGXR8_Z5jdHi6B-myT', description: 'nanoid 21자' })
  token!: string;

  @ApiProperty({
    example: 'http://localhost:3000/s/V1StGXR8_Z5jdHi6B-myT',
    description: '바로 공유 가능한 완성된 URL',
  })
  shareUrl!: string;

  @ApiProperty({ enum: ShareTarget })
  target!: ShareTarget;

  @ApiProperty({ example: '7c8e0f1a-...' })
  targetId!: string;

  @ApiProperty({ example: '2026-06-16T00:00:00.000Z', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ example: false, description: '비밀번호 보호 여부 (해시는 응답 X)' })
  hasPassword!: boolean;

  @ApiProperty({ enum: ExifStripPolicy })
  exifStripPolicy!: ExifStripPolicy;

  @ApiProperty({ example: '2026-06-09T12:00:00.000Z' })
  createdAt!: string;
}
