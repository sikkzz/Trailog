// GetMomentsResponseDto — GET /moments.
//
// 본인의 moment 리스트 반환. 정렬: createdAt DESC (최근 만든 순간이 위).
// 페이지네이션은 Phase 후속 — 현재는 사용자당 moment 수가 작아 전체 반환.
//
// 학습 포인트:
// - 단일 item shape은 CreateMomentResponseDto와 동일하지만 명시적 분리 (룰: Request/Response 명시).
// - 페이지네이션 도입 시 별도 PaginatedMomentsResponseDto로 정정 (메타 정보 추가).

import { ApiProperty } from '@nestjs/swagger';

export class MomentListItemDto {
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

export class GetMomentsResponseDto {
  @ApiProperty({ type: [MomentListItemDto] })
  moments!: MomentListItemDto[];
}
