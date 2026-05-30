// 인증 lib 전역 타입.
//
// 참조 프론트 비교 (참조 프론트):
// - 회사: APIError(message, status, data, method) — `method` enum이 클라 후속 액션 결정
//        (LOGIN_REQUIRED → getUserInfo refetch, TWO_FA_REQUIRED → check2FAToken refetch)
// - Trailog: ApiError(message, status, body). `method` 필드는 Phase 후속 도입 (메모리
//            `error-handling-revisit` — 백엔드 RestResponse + method enum 도입 시점).
//
// 참조처럼 class로 둔 사유:
// - interface 대신 class → instanceof 체크 가능 (참조 AuthGuard에서 `error instanceof APIError`)
// - 단순 Error 던지면 status/body 못 받음

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** 백엔드 에러 응답을 JS Error에 매핑. status + body 동시 박제. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * 인증 헤더 자동 첨부 여부. signup/login/refresh 같은 public route는 false.
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
