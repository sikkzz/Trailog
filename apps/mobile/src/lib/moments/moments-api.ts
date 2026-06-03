// Moments API — apiRequest wrapper + Schema parse.
//
// 패턴 (ADR-0008):
//   1. apiRequest로 호출 → RestResponse unwrap → unknown data 반환
//   2. Schema.parse(data)로 런타임 검증 → 타입 안전한 결과
//
// 참조 (Next.js Web) 비교:
// - 회사: class service + axios + class-instance 메서드 (`legacyProjectAPIService.getMyProjects()`)
// - Trailog: 함수형 + fetch wrapper + Schema.parse — 트렌드 따름 (api-client-patterns 학습 노트)

import { apiRequest } from '../auth';

import {
  CreateMomentRequestSchema,
  CreateMomentResponseSchema,
  GetMomentsResponseSchema,
  type CreateMomentRequest,
  type CreateMomentResponse,
  type GetMomentsResponse,
} from './moments-schemas';

/** GET /moments — 본인의 Moment 리스트 (createdAt DESC). */
export async function fetchMoments(): Promise<GetMomentsResponse> {
  const data = await apiRequest('/moments');
  return GetMomentsResponseSchema.parse(data);
}

/** POST /moments — 새 Moment 생성. */
export async function createMoment(body: CreateMomentRequest): Promise<CreateMomentResponse> {
  // input 자체도 Schema로 검증 — 의도치 않은 필드 차단
  const validated = CreateMomentRequestSchema.parse(body);
  const data = await apiRequest('/moments', {
    method: 'POST',
    body: validated,
  });
  return CreateMomentResponseSchema.parse(data);
}
