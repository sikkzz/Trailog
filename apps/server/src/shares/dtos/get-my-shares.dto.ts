// GetMyShareListItemDto / GetMySharesResponseDto — GET /shares (본인 활성 공유 목록).
//
// 학습 포인트:
// - 만료된 공유는 service 단에서 필터 (expires_at < NOW() 제외)
// - 응답에 token 포함 — 본인이 다시 URL 공유할 수 있게
// - hasPassword: boolean — 비밀번호 해시는 응답 X

import { ApiProperty } from '@nestjs/swagger';

import { ExifStripPolicy, ShareTarget } from '../share.entity';

export class ShareListItemDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({ example: 'V1StGXR8_Z5jdHi6B-myT' })
  token!: string;

  @ApiProperty({ example: 'http://localhost:3000/s/V1StGXR8_Z5jdHi6B-myT' })
  shareUrl!: string;

  @ApiProperty({ enum: ShareTarget })
  target!: ShareTarget;

  @ApiProperty({ example: '7c8e0f1a-...' })
  targetId!: string;

  @ApiProperty({ example: '2026-06-16T00:00:00.000Z', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ example: false })
  hasPassword!: boolean;

  @ApiProperty({ enum: ExifStripPolicy })
  exifStripPolicy!: ExifStripPolicy;

  @ApiProperty({ example: '2026-06-09T12:00:00.000Z' })
  createdAt!: string;
}

export class GetMySharesResponseDto {
  @ApiProperty({ type: [ShareListItemDto] })
  shares!: ShareListItemDto[];
}
