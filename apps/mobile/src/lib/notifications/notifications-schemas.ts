// Notifications payload schema (ADR-0008 일관 — Zod로 런타임 검증).
//
// 백엔드 `apps/server/src/notifications/notifications.service.ts`의 NotificationPayload와 sync.
// SSE는 외부 응답이라 z.discriminatedUnion으로 type 안전 파싱.

import { z } from 'zod';

const PhotoProcessedSchema = z.object({
  type: z.literal('photo.processed'),
  photoId: z.string(),
  status: z.enum(['done', 'failed']),
  momentId: z.string(),
});

const ShareViewedSchema = z.object({
  type: z.literal('share.viewed'),
  shareId: z.string(),
  target: z.enum(['photo', 'moment']),
  targetId: z.string(),
});

export const NotificationPayloadSchema = z.discriminatedUnion('type', [
  PhotoProcessedSchema,
  ShareViewedSchema,
]);

export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
