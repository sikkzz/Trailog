// CreateMomentRequestDto / CreateMomentResponseDto — POST /moments.
//
// Moment = 사용자가 남기고 싶은 어떤 순간이든 (여행/일상/단발 무관).
// 학습 포인트:
// - @IsDateString — ISO 8601 형식 검증 (예: '2026-04-15T00:00:00Z').
// - 시작/종료일은 사용자 자유 입력 — 단발 방문은 둘 다 비울 수 있음.
// - 응답 timestamp는 ISO 8601 string — 모바일에서 Date 객체 변환 자유.

import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMomentRequestDto {
  @ApiProperty({
    example: '도쿄 여행',
    maxLength: 255,
    description: '순간 제목 — 자유 표현 (여행/카페/산책 등 무관)',
  })
  @IsString()
  @MinLength(1, { message: '순간 제목을 입력하세요' })
  @MaxLength(255, { message: '순간 제목은 255자 이하여야 합니다' })
  title!: string;

  @ApiProperty({
    example: '2026-04-15T00:00:00Z',
    required: false,
    description: 'ISO 8601 — 순간 시작 (선택, 단발 방문은 비워도 OK)',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiProperty({
    example: '2026-04-22T00:00:00Z',
    required: false,
    description: 'ISO 8601 — 순간 종료 (선택)',
  })
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

export class CreateMomentResponseDto {
  @ApiProperty({ example: '7c8e0f1a-...' })
  id!: string;

  @ApiProperty({ example: '도쿄 여행' })
  title!: string;

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ example: '2026-04-22T00:00:00.000Z', nullable: true })
  endedAt!: string | null;

  @ApiProperty({ example: '2026-05-30T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-30T12:00:00.000Z' })
  updatedAt!: string;
}
