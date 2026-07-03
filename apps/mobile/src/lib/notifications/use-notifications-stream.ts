// SSE 글로벌 mount 훅 — _layout.tsx에서 로그인 후 활성화.
//
// 동작:
// - access token 있으면 SSE 연결
// - photo.processed → 해당 moment의 photos query invalidate (polling 대체 → SSE push)
// - share.viewed → notifications key invalidate (알림 센터 refetch, D3+에서 활용)
// - 컴포넌트 unmount 또는 token 변경 시 정리

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { photosKeys } from '../photos/photos-queries';

import { notificationsKeys, useAddNotification } from './notifications-queries';
import { connectNotificationsStream } from './notifications-stream';

export function useNotificationsStream(accessToken: string | null): void {
  const queryClient = useQueryClient();
  const addNotification = useAddNotification();

  useEffect(() => {
    if (!accessToken) return;

    const handle = connectNotificationsStream(
      accessToken,
      (payload) => {
        // 알림 센터 목록에 누적 (in-memory)
        addNotification(payload);

        if (payload.type === 'photo.processed') {
          // 폴링 대체 — SSE push 받으면 해당 moment 사진 리스트 즉시 refetch
          void queryClient.invalidateQueries({ queryKey: photosKeys.list(payload.momentId) });
        } else if (payload.type === 'share.viewed') {
          // 알림 센터 refetch (React Query 캐시 갱신)
          void queryClient.invalidateQueries({ queryKey: notificationsKeys.list });
        }
      },
      (error) => {
        // 재연결은 react-native-sse가 자동 처리 — 단순 로그만
        console.warn('[SSE] error', error);
      },
    );

    return () => handle.close();
  }, [accessToken, queryClient, addNotification]);
}
