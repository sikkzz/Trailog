// expo-secure-store 기반 token 저장 — iOS Keychain / Android Keystore에 OS-level 암호화.
//
// 웹 ↔ 모바일 차이 (참조 프론트 참조 프론트 비교):
// - 참조 (웹): httpOnly cookie + CSRF token. document.cookie로 CSRF만 읽고
//             access/refresh는 JS 접근 불가 (XSS 방어). RestAPIInstance가 cookie
//             기반 호출.
// - Trailog (모바일): expo-secure-store + Bearer header. 모바일은 XSS/CSRF 위험
//             자체 X → cookie의 이점 무용. Keychain/Keystore가 OS 레벨 안전.
//
// 모바일 자체 보편 옵션:
// - AsyncStorage: 평문 파일. jailbreak/root 시 노출. 일반 데이터는 OK, 비밀번호/token은 X.
// - SecureStore: OS Keychain/Keystore. 비밀번호/token 저장 표준.
// - MMKV (react-native-mmkv): 빠른 KV. 보안 옵션 있음. SecureStore보다 빠름.
//
// → Trailog는 SecureStore 채택 (Expo 표준 + 학습 자료 풍부 + Q2 결정).

import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from './auth-types';

const KEYS = {
  access: 'auth.accessToken',
  refresh: 'auth.refreshToken',
} as const;

export const authStorage = {
  /** signup/login/refresh 성공 직후 호출. 두 token 동시 저장. */
  async setTokens(tokens: TokenPair): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.access, tokens.accessToken),
      SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.access);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.refresh);
  },

  /** 부팅 시 로그인 상태 확인용 — 둘 다 있어야 valid. */
  async getTokens(): Promise<TokenPair | null> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(KEYS.access),
      SecureStore.getItemAsync(KEYS.refresh),
    ]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  /** 로그아웃 또는 refresh 실패 시 호출. 두 token 동시 삭제. */
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.access),
      SecureStore.deleteItemAsync(KEYS.refresh),
    ]);
  },
};
