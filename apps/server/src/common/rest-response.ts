// RestResponse — 모든 API 응답의 표준 wrapper.
//
// 모바일 client는 응답의 `code` + `method` enum으로 다음 액션 자동 결정:
// - method=LOG_OUT → secure storage 비우기 + 로그인 화면 이동
// - method=LOGIN_REQUIRED → 로그인 화면 redirect
// - method=BLOCKED → 차단 안내 화면
//
// 학습 포인트:
// - HTTP status는 표준 (200/401/409 등)이지만, 도메인 의미는 code enum이 담음.
// - 같은 401이라도 token 만료 vs IP 차단 vs 계정 정지 등 클라 처리 방식 다름.
// - Phase 후속 확장 예정 코드(TOKEN_NOT_FOUND, BLOCKED, RATE_LIMITED, MAINTENANCE)
//   는 도입 시점에 추가.

import { HttpStatus } from '@nestjs/common';

export enum RestResponseType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum RestResponseCode {
  NORMAL = '001',
  INVALID_PARAMETER = '002',
  TOKEN_EXPIRED = '003',
  VALIDATE_ERROR = '004',
  DUPLICATE_ERROR = '005',
  NOT_FOUND = '006',
  UNAUTHORIZED = '007',
  FORBIDDEN = '008',
  INTERNAL_SERVER_ERROR = '009',
}

export enum RestResponseMethod {
  NONE = 'NONE',
  LOG_OUT = 'LOG_OUT',
  LOGIN_REQUIRED = 'LOGIN_REQUIRED',
  BLOCKED = 'BLOCKED',
}

interface RestResponseOptions<T> {
  type: RestResponseType;
  code: string;
  data: T | null;
  message: string | null;
  status: number;
  method: RestResponseMethod;
}

interface RestResponseSuccessOption {
  message?: string;
  code?: string;
  status?: number;
  method?: RestResponseMethod;
}

interface RestResponseErrorOption<T> {
  data?: T | null;
  code?: string;
  status?: number;
  method?: RestResponseMethod;
}

/**
 * 모든 API 응답의 표준 형태.
 *
 * Builder pattern (fluent interface) — `.success(data)` / `.error(msg)` 후 setter chain.
 *
 * 사용:
 *   return new RestResponse<SignInResponseDto>().success({ accessToken, refreshToken });
 *   return new RestResponse<SignInResponseDto>().error('비밀번호 불일치', {
 *     code: RestResponseCode.UNAUTHORIZED,
 *     status: HttpStatus.UNAUTHORIZED,
 *   });
 */
export class RestResponse<T = unknown> {
  private _type: RestResponseType = RestResponseType.SUCCESS;
  private _code: string = RestResponseCode.NORMAL;
  private _data: T | null = null;
  private _message: string | null = null;
  private _status: number = HttpStatus.OK;
  private _method: RestResponseMethod = RestResponseMethod.NONE;

  get type(): RestResponseType {
    return this._type;
  }

  get code(): string {
    return this._code;
  }

  get data(): T | null {
    return this._data;
  }

  get message(): string | null {
    return this._message;
  }

  get status(): number {
    return this._status;
  }

  get method(): RestResponseMethod {
    return this._method;
  }

  /** 응답 직렬화 — controller 반환 / interceptor wrap 시 호출 */
  build(): RestResponseOptions<T> {
    return {
      type: this._type,
      code: this._code,
      data: this._data,
      message: this._message,
      status: this._status,
      method: this._method,
    };
  }

  /**
   * JSON.stringify가 자동 호출 — NestJS 응답 직렬화 시점.
   * 없으면 private field가 `_type/_code/_data...` 그대로 노출됨 (모바일 client의 `isRestResponse`
   * 가드 실패 → 응답 unwrap 안 됨). Phase 2 4.6 D2 모바일 통합 검증 중 발견.
   */
  toJSON(): RestResponseOptions<T> {
    return this.build();
  }

  /** 성공 응답 — data 박제 후 옵션으로 message/code/status/method 설정 */
  success(data: T, option: RestResponseSuccessOption = {}): this {
    this._type = RestResponseType.SUCCESS;
    this._data = data;

    if (option.message) {
      this._message = option.message;
    }

    if (option.code) {
      this._code = option.code;
    }

    if (option.status) {
      this._status = option.status;
    }

    if (option.method) {
      this._method = option.method;
    }

    return this;
  }

  /** 에러 응답 — message 박제 후 옵션으로 data/code/status/method 설정 */
  error(message: string, option: RestResponseErrorOption<T> = {}): this {
    this._type = RestResponseType.ERROR;
    this._message = message;
    this._status = this._status === HttpStatus.OK ? HttpStatus.INTERNAL_SERVER_ERROR : this._status;
    this._code = RestResponseCode.INTERNAL_SERVER_ERROR;

    if (option.data !== undefined) {
      this._data = option.data;
    }

    if (option.code) {
      this._code = option.code;
    }

    if (option.status) {
      this._status = option.status;
    }

    if (option.method) {
      this._method = option.method;
    }

    return this;
  }

  setStatus(status: number): this {
    this._status = status;
    return this;
  }

  setMethod(method: RestResponseMethod): this {
    this._method = method;
    return this;
  }
}
