// 알림 센터 상태 — React Query 캐시 활용 (in-memory 휘발).
//
// 서버 영속화 X (Phase 3 5.3 스코프 — 메모리 sse-phase4-enhancements-revisit).
// SSE로 도착한 payload를 setQueryData로 캐시에 push → 알림 센터 UI가 useNotifications()로 구독.
//
// 상태 lib 도입 X 사유: React Query 캐시가 이미 subscribe/publish 모델 — Zustand 트리거 X.
// (메모리 client-state-mgmt-revisit — 알림은 서버 이벤트라 React Query fit)

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationPayload } from './notifications-schemas';

/** 알림 리스트 최대 개수 — 초과분은 오래된 순서로 drop */
const MAX_NOTIFICATIONS = 50;

export interface NotificationItem {
  id: string; // 클라이언트 생성 uuid (payload에는 id 없음)
  payload: NotificationPayload;
  receivedAt: number; // epoch ms
  read: boolean;
}

export const notificationsKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
};

/**
 * 알림 리스트 조회 — 최근 순.
 * 초기값: 빈 배열 (SSE 도착 payload가 setQueryData로 push).
 */
export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: notificationsKeys.list,
    queryFn: () => Promise.resolve([]),
    initialData: [],
    staleTime: Infinity, // 서버 fetch X — SSE push로만 갱신
  });
}

/**
 * 알림 추가 — SSE 훅에서 payload 도착 시 호출.
 */
export function useAddNotification() {
  const queryClient = useQueryClient();

  return useCallback(
    (payload: NotificationPayload) => {
      queryClient.setQueryData<NotificationItem[]>(notificationsKeys.list, (prev = []) => {
        const item: NotificationItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          payload,
          receivedAt: Date.now(),
          read: false,
        };
        const next = [item, ...prev];
        return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
      });
    },
    [queryClient],
  );
}

/**
 * 알림 읽음 처리 — 단일 항목.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: string) => {
      queryClient.setQueryData<NotificationItem[]>(notificationsKeys.list, (prev = []) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
    },
    [queryClient],
  );
}

/** 안읽은 알림 개수 — 뱃지용 */
export function useUnreadNotificationsCount(): number {
  const { data } = useNotifications();
  return data.filter((item) => !item.read).length;
}
