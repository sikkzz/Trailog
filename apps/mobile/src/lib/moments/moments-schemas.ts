// Moments Zod schemas — ADR-0008 적용.
//
// 백엔드 DTO (`apps/server/src/moments/dtos/`)와 sync:
// - CreateMomentRequest/Response, GetMoments(Response)
//
// 단일 출처 — `z.infer<typeof Schema>` 로 TS 타입 자동 추론 (인터페이스 X).

import { z } from 'zod';

// =============================================================================
// Moment (단일 item — 백엔드 MomentListItemDto / CreateMomentResponseDto와 동일 shape)
// =============================================================================

export const MomentSchema = z.object({
  id: z.string(),
  title: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Moment = z.infer<typeof MomentSchema>;

// =============================================================================
// POST /moments — Moment 생성
// =============================================================================

export const CreateMomentRequestSchema = z.object({
  title: z.string().min(1, '순간 제목을 입력하세요').max(255, '순간 제목은 255자 이하여야 합니다'),
  startedAt: z.string().datetime({ offset: true }).optional(),
  endedAt: z.string().datetime({ offset: true }).optional(),
});

export const CreateMomentResponseSchema = MomentSchema;

export type CreateMomentRequest = z.infer<typeof CreateMomentRequestSchema>;
export type CreateMomentResponse = z.infer<typeof CreateMomentResponseSchema>;

// =============================================================================
// GET /moments — Moment 리스트
// =============================================================================

export const GetMomentsResponseSchema = z.object({
  moments: z.array(MomentSchema),
});

export type GetMomentsResponse = z.infer<typeof GetMomentsResponseSchema>;
