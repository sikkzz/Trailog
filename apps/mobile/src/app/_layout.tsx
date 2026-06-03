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
// 인증 분기 redirect는 D2 (auth 화면 구현 시) 도입.

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from '../lib/query-client';

export default function RootLayout() {
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
