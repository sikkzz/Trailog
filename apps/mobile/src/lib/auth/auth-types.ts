// 인증 lib 전역 타입.
//
// 참조 프론트 비교:
// - 회사: APIError(message, status, data, method) — `method` enum이 클라 후속 액션 결정
//        (LOGIN_REQUIRED → getUserInfo refetch, TWO_FA_REQUIRED → check2FAToken refetch)
// - Trailog: ApiError(message, status, body, code, method) — 백엔드 RestResponse와 sync.
//            method 자동 처리: LOG_OUT → secure storage clear + onUnauthorized 콜백.
//
// 참조처럼 class로 둔 사유:
// - interface 대신 class → instanceof 체크 가능 (참조 AuthGuard에서 `error instanceof APIError`)
// - 단순 Error 던지면 status/body 못 받음

// TokenPair는 ADR-0008 적용으로 auth-schemas.ts로 이동 (z.infer 단일 출처).
// 다른 모듈은 `import type { TokenPair } from './auth-schemas'` 또는 barrel export 사용.

// 백엔드 RestResponse (apps/server/src/common/rest-response.ts)와 sync.
// 모든 백엔드 응답은 이 wrapper 구조.
export type RestResponseType = 'SUCCESS' | 'ERROR';
export type RestResponseMethod = 'NONE' | 'LOG_OUT' | 'LOGIN_REQUIRED' | 'BLOCKED';

export interface RestResponse<T> {
  type: RestResponseType;
  code: string;
  data: T | null;
  message: string | null;
  status: number;
  method: RestResponseMethod;
}

/** 백엔드 에러 응답을 JS Error에 매핑. status/body/code/method 동시 박제. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly code: string;
  readonly method: RestResponseMethod;

  constructor(
    message: string,
    status: number,
    body: unknown,
    code: string,
    method: RestResponseMethod,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = code;
    this.method = method;
  }
}

// TokenPair re-export — 기존 import 사이트 호환 (auth-storage.ts 등)
export type { TokenPair } from './auth-schemas';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * 인증 헤더 자동 첨부 여부. sign-up/sign-in/refresh 같은 public route는 false.
   * 기본 true (대부분 endpoint가 protected).
   */
  authenticated?: boolean;
  /**
   * 내부 retry 표시 — 401 자동 갱신 후 재시도 호출에 박힘. 사용자가 직접 박지 말 것.
   *
   * 참조 패턴 차용 (RestAPIInstance의 `_retried` flag):
   * - retry된 요청에 다시 401 오면 추가 갱신 시도 X (무한 루프 방어)
   * - undefined → 첫 시도, true → 재시도 결과 (다시 401이면 즉시 fail)
   */
  _retried?: boolean;
}
