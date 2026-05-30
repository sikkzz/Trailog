// API 클라이언트 — fetch wrapper + 자동 token 첨부 + 401 자동 refresh + retry 1회.
//
// =============================================================================
// 1. 도구 선택 (Layer L1)
// =============================================================================
//
// 참조 프론트 (참조 프론트) — `src/utils/api/rest.ts`:
// - axios + 자체 class 2단계 wrapper (RestAPIInstance → RestAPI)
// - `axios.interceptors.request/response.use()` + class 내부 상태 (refreshInflight)
//
// 보편적 RN 옵션:
// - axios: 풍부한 interceptor + plugin (axios-auth-refresh). 참조 패턴.
// - fetch wrapper: 의존성 0, RN 기본, interceptor 직접 구현 (학습 가치).
// - ofetch / ky: 모던 대안. 신생.
//
// Trailog 선택: fetch wrapper (직접 구현) + 함수 + closure
// 사유:
// 1. 참조 axios는 이미 친숙 → 사이드 fetch로 의도적 다양화 (TypeORM과 반대 전략)
// 2. 모바일 번들 사이즈 의식 (~50KB axios 절약. 사이드엔 작지만 의식 학습)
// 3. Interceptor 내부 동작 직접 정복 (refresh race condition, retry policy)
// 4. Class 2단계는 대규모(다중 API instance + legacy 호환) 사유. 사이드엔 over.
//
// =============================================================================
// 2. 인증 layer (참조 패턴 채택)
// =============================================================================
//
// ✅ 채택 (회사와 동일):
// - **refreshPromise 단일화** (회사: `refreshInflight`) — 동시 401 발생 시 refresh
//   호출 1번만. 가장 흥미로운 패턴 (race condition 방어 표준).
// - **_retried flag in options** (회사: config의 `_retried`) — retry된 요청에 또
//   401 오면 즉시 fail. 무한 루프 방어. 참조 패턴 차용해서 더 명확하게.
// - **isRefreshEndpoint() 명시 분기** (회사: `isRefreshRequest`) — refresh API 호출
//   자체는 자동 갱신 안 함 (자기 자신 호출 방지).
// - **`x-client-platform: 'mobile'` header** (회사: 'web') — 백엔드가 향후 클라 종류
//   구분 가능 (analytics / A/B / device-specific 응답 등).
// - **method enum 자동 처리** (회사: response의 `method` 따라 LOGIN_REQUIRED 등 액션) —
//   백엔드 RestResponse 도입 후 채택. LOG_OUT/LOGIN_REQUIRED 자동 처리.
//
// =============================================================================
// 3. 백엔드 RestResponse 구조 처리
// =============================================================================
//
// 모든 백엔드 응답은 `{ type, code, data, message, status, method }` 형태:
// - executeRequest가 자동 unwrap → 호출자엔 `data` 만 반환
// - type=ERROR → ApiError throw (code/method 동봉)
// - method=LOG_OUT → secure storage clear + onUnauthorized 콜백
// - method=LOGIN_REQUIRED → onUnauthorized 콜백 (storage clear는 X)
//
// =============================================================================
// 4. 자동 흐름 다이어그램
// =============================================================================
//
//   [요청] → access token 첨부 → 서버 → 200 OK (data unwrap)
//   [요청] → access token 첨부 → 서버 → 401 (만료)
//          → refreshTokens() 시도 (in-flight promise 단일화)
//          → 새 token 저장 + _retried: true 박제 후 재호출
//          → 200 OK
//   [재시도 요청] → 또 401 → _retried가 true이므로 즉시 fail (무한 루프 방어)
//   [요청] → refresh도 실패 → token clear → onUnauthorized 콜백

import { authStorage } from './auth-storage';
import {
  ApiError,
  type ApiRequestOptions,
  type RestResponse,
  type RestResponseMethod,
  type TokenPair,
} from './auth-types';

// EXPO_PUBLIC_* 환경변수는 build time inline됨 (Expo 표준, Next.js의 NEXT_PUBLIC_과 동일).
// 로컬 dev fallback: localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Refresh endpoint path — `isRefreshEndpoint()`와 main fetch 둘 다에서 참조.
const REFRESH_PATH = '/auth/refresh';

// 진행 중인 refresh promise — 동시 요청은 이걸 await해서 refresh 1번만 실행.
// 참조 `RestAPIInstance.refreshInflight`와 동일 사고.
let refreshPromise: Promise<TokenPair | null> | null = null;

// 401 + refresh 모두 실패 시 또는 method=LOG_OUT/LOGIN_REQUIRED 시 호출.
// 상위 layer(Expo Router root)에서 박제.
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback;
}

/**
 * 참조 `RestAPIInstance.isRefreshRequest`와 동일 — refresh API 자체엔 401 자동 갱신 X.
 * 자기 자신 호출하면 무한 루프.
 */
function isRefreshEndpoint(path: string): boolean {
  return path === REFRESH_PATH;
}

/** RestResponse 구조 타입 가드 — 백엔드 표준 응답인지 확인. */
function isRestResponse<T>(body: unknown): body is RestResponse<T> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    'code' in body &&
    'data' in body &&
    'method' in body
  );
}

/**
 * Refresh token으로 새 token pair 발급.
 *
 * Race condition 방어 (참조 패턴 동일):
 * - 진행 중인 promise 있으면 그걸 반환 → refresh 1번만 실행
 * - finally에서 promise 초기화 → 다음 refresh 시 새로 시작
 *
 * 실패 시:
 * - secure storage 모두 삭제 + onUnauthorized 콜백 호출
 * - null 반환 → 호출자가 원 에러 throw
 */
async function refreshTokens(): Promise<TokenPair | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) {
      onUnauthorized?.();
      return null;
    }

    try {
      const response = await fetch(`${API_URL}${REFRESH_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-platform': 'mobile',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const body = (await response.json()) as RestResponse<TokenPair>;
      if (body.type === 'ERROR' || !body.data) {
        // refresh도 만료/유효하지 않음 → 강제 로그아웃
        await authStorage.clear();
        onUnauthorized?.();
        return null;
      }

      const tokens = body.data;
      await authStorage.setTokens(tokens);
      return tokens;
    } catch {
      // 네트워크 에러 등. token은 그대로 (일시적 에러일 수 있음) + null 반환.
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * 실제 fetch 호출 + RestResponse unwrap + 에러 변환.
 * apiRequest의 retry 흐름에서 두 번 호출 가능 (첫 시도 + refresh 후 재시도).
 */
async function executeRequest<T>(
  path: string,
  options: ApiRequestOptions,
  accessToken: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-platform': 'mobile', // 참조 'web'과 평행 — 백엔드 클라 구분용
    ...options.headers,
  };
  if (accessToken && options.authenticated !== false) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // 204 No Content (sign-out 등): 본문 없으므로 undefined 반환
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const rawBody = text ? (JSON.parse(text) as unknown) : null;

  // RestResponse 구조 — 백엔드 표준 응답
  if (isRestResponse<T>(rawBody)) {
    if (rawBody.type === 'ERROR') {
      throw new ApiError(
        rawBody.message ?? `HTTP ${response.status}`,
        rawBody.status || response.status,
        rawBody,
        rawBody.code,
        rawBody.method,
      );
    }
    return rawBody.data as T;
  }

  // 비표준 응답 (외부 API 또는 NestJS validation 자동 throw 등) — 그대로 처리
  if (!response.ok) {
    const message =
      typeof rawBody === 'object' && rawBody !== null && 'message' in rawBody
        ? String((rawBody as { message: unknown }).message)
        : `HTTP ${response.status}`;
    throw new ApiError(message, response.status, rawBody, '009', 'NONE');
  }

  return rawBody as T;
}

/** method enum에 따라 자동 액션 — LOG_OUT/LOGIN_REQUIRED 시 상위 콜백 호출. */
async function handleErrorMethod(method: RestResponseMethod): Promise<void> {
  if (method === 'LOG_OUT') {
    await authStorage.clear();
    onUnauthorized?.();
    return;
  }

  if (method === 'LOGIN_REQUIRED') {
    onUnauthorized?.();
  }
}

/**
 * Public API — 모든 모바일 → 백엔드 호출의 입구.
 *
 * 사용 예:
 *   const me = await apiRequest<{ id: string; email: string }>('/auth/me');
 *   const tokens = await apiRequest<TokenPair>('/auth/sign-in', {
 *     method: 'POST',
 *     body: { email, password },
 *     authenticated: false,
 *   });
 *
 * 향후 (Phase 2 4.6) react-query 도입 시 패턴:
 *   useQuery({ queryKey: ['me'], queryFn: () => apiRequest('/auth/me') });
 *   useMutation({ mutationFn: (body) => apiRequest('/trips', { method: 'POST', body }) });
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const accessToken = await authStorage.getAccessToken();

  try {
    return await executeRequest<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // 401 자동 갱신 조건 (참조 RestAPIInstance.initAjax의 조건 평행):
    // 1. status === 401
    // 2. _retried 아직 false (1회만 재시도 — 무한 루프 방어)
    // 3. 인증 요청 (authenticated !== false)
    // 4. refresh endpoint 자체 호출 X (자기 자신 호출 방지)
    // 5. 원래 access token이 있었음 (애초 로그인 전이면 refresh 의미 X)
    const shouldRefresh =
      error.status === 401 &&
      !options._retried &&
      options.authenticated !== false &&
      !isRefreshEndpoint(path) &&
      accessToken !== null;

    if (shouldRefresh) {
      const newTokens = await refreshTokens();
      if (newTokens) {
        // 새 access token으로 한 번만 재시도. _retried: true 박아 무한 루프 방어.
        return executeRequest<T>(path, { ...options, _retried: true }, newTokens.accessToken);
      }
    }

    // refresh 시도 안 했거나 실패한 경우 — method enum 자동 처리 후 throw
    await handleErrorMethod(error.method);
    throw error;
  }
}
