// Root Layout — Expo Router 진입 지점.
//
// 구조:
//   - QueryClientProvider — 서버 상태 관리 (React Query). 글로벌 상태 lib 미도입 (메모리 `client-state-mgmt-revisit`)
//   - Stack — 모든 화면 native stack (header 숨김)
//   - (auth)/* — 미인증 흐름 (login, signup)
//   - (tabs)/* — 인증 후 메인 (moments, map)
//   - moments/[momentId] — Moment 상세
//   - photos/[photoId] — 사진 상세
//
// 인증 layer 박제:
//   1. 진입 분기 (index.tsx useEffect) — 첫 진입 시 token 있으면 tabs, 없으면 auth
//   2. **API 401 자동 redirect** (setOnUnauthorized) — refresh 실패 또는 method=LOG_OUT/LOGIN_REQUIRED 시
//      자동 로그인 화면으로. Phase 2 4.1 api-client에 인프라 박혀있었으나 callback 미등록 상태였음.
//      D3 진입 (useMoments 호출) 전에 박는 게 필수.

import '../../global.css'; // NativeWind v4 — Tailwind atomic styles 주입 (Phase 2 4.8 D2-1)

import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { setOnUnauthorized } from '../lib/auth';
import { queryClient } from '../lib/query-client';

export default function RootLayout() {
  // API 401 + refresh 실패 시 / method=LOG_OUT 시 자동 로그인 redirect.
  // api-client는 authStorage.clear()까지 처리 — root는 navigation만 책임.
  useEffect(() => {
    setOnUnauthorized(() => {
      router.replace('/(auth)/login' as never);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </QueryClientProvider>
  );
}
