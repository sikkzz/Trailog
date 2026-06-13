// Web → Backend API client.
//
// Server Components에서 호출 — fetch + Zod parse.
// `NEXT_PUBLIC_API_URL` 환경변수 (없으면 default `http://localhost:4000`).
// 단 SSR fetch는 server-side(Node)에서 실행 → localhost OK.

import { z } from 'zod';

import { PublicShareResponseSchema, type PublicShareResponse } from './schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** GET /geocoding/reverse — NCP 한국어 주소 (모바일과 같은 endpoint, 인증 X) */
const ReverseGeocodeResponseSchema = z.object({
  address: z.string().nullable(),
});

export async function fetchReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  // 백엔드 public endpoint — 인증 X (Web 공유 페이지 전용)
  const url = `${API_URL}/geocode/public/reverse?lat=${latitude}&lng=${longitude}`;
  const res = await fetch(url, { cache: 'force-cache' }); // 좌표 → 주소는 영구 — 캐시
  if (!res.ok) return null;
  const json = await res.json();
  // RestResponse unwrap
  const data =
    typeof json === 'object' && json !== null && 'data' in json
      ? (json as { data: unknown }).data
      : json;
  const parsed = ReverseGeocodeResponseSchema.safeParse(data);
  return parsed.success ? parsed.data.address : null;
}

/**
 * RestResponse unwrap — 백엔드는 `{ data, error, ... }` 형태로 감쌈.
 * 성공: data 반환. 실패: throw.
 */
function unwrap<T>(json: unknown): T {
  if (typeof json !== 'object' || json === null) {
    throw new Error('백엔드 응답 형식 오류');
  }
  const obj = json as Record<string, unknown>;

  // 백엔드 RestResponse 형태 — `success/data` 우선, `error.message` fallback
  if ('data' in obj && obj.data !== undefined) {
    return obj.data as T;
  }
  if ('error' in obj && typeof obj.error === 'object' && obj.error !== null) {
    const errObj = obj.error as { message?: string };
    throw new Error(errObj.message ?? '응답 에러');
  }
  // 일부 단순 응답은 unwrap 없이 그대로
  return json as T;
}

/**
 * GET /shares/public/:token — 외부 사용자 진입점.
 *
 * 404/410은 Next의 notFound() / gone 처리 위해 throw with status.
 * 200: data parse 후 반환.
 */
export async function fetchPublicShare(token: string): Promise<{
  status: number;
  data?: PublicShareResponse;
}> {
  const res = await fetch(`${API_URL}/shares/public/${encodeURIComponent(token)}`, {
    cache: 'no-store', // SSR 매 요청 — 만료 즉시 반영
  });

  if (res.status === 404 || res.status === 410) {
    return { status: res.status };
  }

  if (!res.ok) {
    throw new Error(`백엔드 호출 실패: ${res.status}`);
  }

  const json = await res.json();
  const data = unwrap<PublicShareResponse>(json);
  return { status: 200, data: PublicShareResponseSchema.parse(data) };
}

/**
 * POST /shares/public/:token/unlock — 비밀번호 검증.
 *
 * 401: 비밀번호 불일치 → status만 반환.
 * 200: data 반환.
 */
export async function unlockPublicShare(
  token: string,
  password: string,
): Promise<{ status: number; data?: PublicShareResponse }> {
  const res = await fetch(`${API_URL}/shares/public/${encodeURIComponent(token)}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 404 || res.status === 410) {
    return { status: res.status };
  }

  if (!res.ok) {
    throw new Error(`백엔드 호출 실패: ${res.status}`);
  }

  const json = await res.json();
  const data = unwrap<PublicShareResponse>(json);
  return { status: 200, data: PublicShareResponseSchema.parse(data) };
}
