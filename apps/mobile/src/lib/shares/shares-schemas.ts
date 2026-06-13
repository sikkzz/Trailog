// Shares Zod schemas — ADR-0008 + ADR-0014 적용.
//
// 백엔드 DTO (`apps/server/src/shares/dtos/`)와 sync:
// - CreateShareRequest/Response, GetMySharesResponse, ShareListItem
//
// 단일 출처 — `z.infer<typeof Schema>` 로 TS 타입 자동 추론.
//
// enum은 백엔드와 동일 string 값 (`photo`/`moment` + `all`/`gps_only`/`none`).

import { z } from 'zod';

// =============================================================================
// enums (백엔드 share.entity.ts와 동일 string 값)
// =============================================================================

export const ShareTargetSchema = z.enum(['photo', 'moment']);
export type ShareTarget = z.infer<typeof ShareTargetSchema>;

export const ExifStripPolicySchema = z.enum(['all', 'gps_only', 'none']);
export type ExifStripPolicy = z.infer<typeof ExifStripPolicySchema>;

// =============================================================================
// Share (단일 item)
// =============================================================================

export const ShareSchema = z.object({
  id: z.string(),
  token: z.string(),
  shareUrl: z.string(),
  target: ShareTargetSchema,
  targetId: z.string(),
  expiresAt: z.string().nullable(),
  hasPassword: z.boolean(),
  exifStripPolicy: ExifStripPolicySchema,
  createdAt: z.string(),
});

export type Share = z.infer<typeof ShareSchema>;

// =============================================================================
// POST /shares — 공유 링크 생성
// =============================================================================

export const CreateShareRequestSchema = z.object({
  target: ShareTargetSchema,
  targetId: z.string().uuid('targetId는 UUID v4 형식이어야 합니다'),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  password: z
    .string()
    .min(4, '비밀번호는 4자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하여야 합니다')
    .optional(),
  exifStripPolicy: ExifStripPolicySchema.optional(),
});

export const CreateShareResponseSchema = ShareSchema;

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;
export type CreateShareResponse = z.infer<typeof CreateShareResponseSchema>;

// =============================================================================
// GET /shares — 본인 활성 공유 목록
// =============================================================================

export const GetMySharesResponseSchema = z.object({
  shares: z.array(ShareSchema),
});

export type GetMySharesResponse = z.infer<typeof GetMySharesResponseSchema>;
