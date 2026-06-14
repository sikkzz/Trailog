// Web shares schemas — Zod (ADR-0008 + ADR-0014 일관).
//
// 백엔드 `apps/server/src/shares/dtos/public-share.dto.ts`와 sync.
// 모바일 `apps/mobile/src/lib/shares/shares-schemas.ts`와도 일관 (단 외부 응답이라 separate).
//
// **단일 출처 추출(`packages/shared`)은 Phase 후속 검토** — 지금은 mirror.

import { z } from 'zod';

export const ShareTargetSchema = z.enum(['photo', 'moment']);
export const ExifStripPolicySchema = z.enum(['all', 'gps_only', 'none']);

export const PublicPhotoSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  downloadUrl: z.string(), // 백엔드 proxy 다운로드 URL (Phase 3 5.2 D5)
  takenAt: z.string().nullable(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable(),
});

export const PublicMomentSchema = z.object({
  id: z.string(),
  title: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  photos: z.array(PublicPhotoSchema),
});

export const PublicShareResponseSchema = z.object({
  status: z.enum(['locked', 'open']),
  target: ShareTargetSchema,
  exifStripPolicy: ExifStripPolicySchema,
  expiresAt: z.string().nullable(),
  photo: PublicPhotoSchema.nullable(),
  moment: PublicMomentSchema.nullable(),
});

export type PublicPhoto = z.infer<typeof PublicPhotoSchema>;
export type PublicMoment = z.infer<typeof PublicMomentSchema>;
export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>;
export type ShareTarget = z.infer<typeof ShareTargetSchema>;
export type ExifStripPolicy = z.infer<typeof ExifStripPolicySchema>;
