// Shares API — apiRequest wrapper + Schema parse.
//
// 패턴 (ADR-0008): Moments lib 일관.
//   1. apiRequest로 호출 → RestResponse unwrap → unknown data 반환
//   2. Schema.parse(data)로 런타임 검증 → 타입 안전한 결과
//
// 외부 사용자가 접근하는 GET /shares/:token + unlock 흐름은 D6 SSR wave에서 박힘.
// 본 lib는 본인이 인증된 상태에서 공유 링크 만들고/조회/취소하는 흐름만.

import { apiRequest } from '../auth';

import {
  CreateShareRequestSchema,
  CreateShareResponseSchema,
  GetMySharesResponseSchema,
  type CreateShareRequest,
  type CreateShareResponse,
  type GetMySharesResponse,
} from './shares-schemas';

/** GET /shares — 본인 활성 공유 목록 (만료 제외, createdAt DESC). */
export async function fetchMyShares(): Promise<GetMySharesResponse> {
  const data = await apiRequest('/shares');
  return GetMySharesResponseSchema.parse(data);
}

/** POST /shares — 공유 링크 생성. body validation은 백엔드도 하지만 모바일에서도 schema parse. */
export async function createShare(body: CreateShareRequest): Promise<CreateShareResponse> {
  const validated = CreateShareRequestSchema.parse(body);
  const data = await apiRequest('/shares', {
    method: 'POST',
    body: validated,
  });
  return CreateShareResponseSchema.parse(data);
}

/** DELETE /shares/:id — 공유 취소 (DB row 삭제, 즉시 무효화). */
export async function deleteShare(shareId: string): Promise<void> {
  await apiRequest(`/shares/${shareId}`, {
    method: 'DELETE',
  });
}
