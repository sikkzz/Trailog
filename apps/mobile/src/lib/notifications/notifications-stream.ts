// SSE stream 관리 — react-native-sse 활용.
//
// react-native-sse 채택 사유:
// - RN EventSource polyfill (RN fetch는 SSE 미지원)
// - Bearer header 첨부 가능 (커스텀 headers 옵션)
// - 자동 재연결 + lastEventId 복구 (EventSource 표준 명세 준수)
// - MIT + 안정 (2020~ 유지보수, 100k+ weekly downloads)
//
// 흐름:
//   1. connectNotificationsStream(accessToken, handler) 호출
//   2. EventSource가 백엔드 /notifications/stream에 GET 연결
//   3. onmessage 콜백 — payload Zod 파싱 후 handler 호출
//   4. 로그아웃/앱 종료 시 close() 호출로 정리
//
// 인증 갱신 시나리오:
// - access token 만료(15분) → 재연결 시점에 새 token 활용 (자동 재연결 lib 처리)
// - 다만 first connect 후 15분+ 지나면 서버가 401 → 클라이언트가 재연결 시도 시 갱신된 token 필요
// - _layout.tsx의 useSseConnection 훅이 access token 변경 시 재연결 트리거

import EventSource from 'react-native-sse';

import { NotificationPayloadSchema, type NotificationPayload } from './notifications-schemas';

/**
 * 백엔드 SSE endpoint URL — apps/mobile/src/lib/auth/api-client.ts의 API_URL과 일관.
 */
function getApiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
}

export interface NotificationsStreamHandle {
  close(): void;
}

/**
 * SSE 연결 시작.
 * @param accessToken JWT access token (Bearer header 첨부)
 * @param onPayload 파싱된 알림 payload 수신 콜백
 * @param onError 연결 에러 콜백 (재연결은 lib이 자동 처리, 단순 로깅용)
 */
export function connectNotificationsStream(
  accessToken: string,
  onPayload: (payload: NotificationPayload) => void,
  onError?: (error: unknown) => void,
): NotificationsStreamHandle {
  const url = `${getApiUrl()}/notifications/stream`;

  const es = new EventSource(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  es.addEventListener('message', (event) => {
    if (!event.data) return;
    try {
      const raw: unknown = JSON.parse(event.data);
      const parsed = NotificationPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        // 스키마 불일치 — 백엔드 payload 확장 시 fail-soft (silent skip)
        return;
      }
      onPayload(parsed.data);
    } catch (e) {
      onError?.(e);
    }
  });

  es.addEventListener('error', (event) => {
    onError?.(event);
  });

  return {
    close: () => es.close(),
  };
}
