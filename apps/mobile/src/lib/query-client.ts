// React Query 글로벌 QueryClient.
//
// Phase 2 4.6 D1 진입 — 서버 상태 관리만으로 충분 (글로벌 상태 lib 미도입, 메모리 `client-state-mgmt-revisit`).
//
// 기본 옵션 결정:
// - staleTime 30초 — 모바일 화면 전환 잦음. 너무 짧으면 매 화면 진입마다 refetch (배터리/데이터 ↓), 너무 길면 stale 데이터.
// - retry 1회 — 모바일 네트워크 불안 시 1회 자동 재시도. 더 박으면 사용자 대기 시간 ↑.
// - refetchOnWindowFocus false — 웹 컨셉 (모바일엔 window focus 의미 약함).
// - refetchOnReconnect true — 모바일은 network 끊김/복원 잦음. 복원 시 자동 refetch.
//
// Phase 후속 — 영구 캐시(AsyncStorage persist) 도입 검토 시 `@tanstack/react-query-persist-client` 추가.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
