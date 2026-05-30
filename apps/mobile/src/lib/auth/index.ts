// auth lib barrel export — 다른 모듈은 항상 이 index에서 import.
//
// 사용:
//   import { apiRequest, authStorage, ApiError, type TokenPair } from '@/lib/auth';
//   (또는 상대 경로 — Expo Router는 @ alias 별도 셋업 필요)
//
// 웹 ↔ 모바일 차이 (barrel export 자체는 동일 패턴):
// - Next.js: 일반적으로 명시적 path import 권장 (tree-shaking + 빌드 속도)
// - RN/Metro: barrel 흔하지만 모든 화면이 commit/dev start 시 평가됨 → 큰 lib는 분리 권장
// → 우리 auth lib는 작아 (3 파일) — barrel 채택 OK.

export { authStorage } from './auth-storage';
export { apiRequest, setOnUnauthorized } from './api-client';
export { ApiError } from './auth-types';
export type {
  ApiRequestOptions,
  HttpMethod,
  RestResponse,
  RestResponseMethod,
  RestResponseType,
  TokenPair,
} from './auth-types';
