// Geocoding Zod schemas — Phase 2 4.7 D6 NCP proxy.
//
// 백엔드 DTO (`apps/server/src/geocoding/dtos/reverse-geocode.dto.ts`)와 sync.

import { z } from 'zod';

// =============================================================================
// GET /geocode/reverse?lat=&lng= — 좌표 → 한국어 주소
// =============================================================================

export const ReverseGeocodeResponseSchema = z.object({
  /** 한국어 주소 (도로명 우선, 지번 fallback). 한국 외/결과 X면 null */
  address: z.string().nullable(),
  /** 도로명/지번 종류. address null이면 null */
  type: z.enum(['road', 'jibun']).nullable(),
});

export type ReverseGeocodeResponse = z.infer<typeof ReverseGeocodeResponseSchema>;
