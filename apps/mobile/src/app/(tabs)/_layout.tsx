// (tabs)/_layout — 인증 후 메인 탭 layout.
//
// 탭 구성:
//   - moments: Moment 리스트 (메인)
//   - map: 지도 탭 (4.7에 채움)
//
// 참조 (Next.js App Router (group)) 패턴 일관 — 인증 상태 기반 layout 분리.
// Phase 2 4.8 D3-3 — Tab Bar 색상/타이포 토큰 적용 (ADR-0011).
//
// `tabBarActiveTintColor` / `tabBarInactiveTintColor` 등은 tailwind class X —
// native option이라 hex 값 직접 박음 (테마 토큰과 같은 값).

import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { authStorage } from '../../lib/auth';
import { useNotificationsStream, useUnreadNotificationsCount } from '../../lib/notifications';

// 토큰 값을 직접 박음 (tailwind.config.js 동기) — Tab Bar는 native option이라 className X
const COLORS = {
  light: {
    primary: '#5C4033', // earthy brown
    surface: '#FFFFFF',
    border: '#E5E5E5',
    textSecondary: '#999999',
  },
  dark: {
    primary: '#C9A085', // light earthy brown (다크에서 가독성 ↑)
    surface: '#0A0A0A',
    border: '#2A2A2A',
    textSecondary: '#737373',
  },
};

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const c = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  // SSE 글로벌 mount — tabs는 이미 인증 후 진입(index.tsx 분기)이라 여기서 mount가 정직.
  // Phase 3 5.3 — 사진 처리 완료 / 공유 조회됨 알림 실시간 수신.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void authStorage.getAccessToken().then((token) => {
      if (!cancelled) setAccessToken(token);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useNotificationsStream(accessToken);
  const unreadCount = useUnreadNotificationsCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
        },
        tabBarLabelStyle: {
          fontFamily: 'Pretendard-Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="moments" options={{ title: 'Moments' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '알림',
          // 안읽음 있을 때만 뱃지 (RN Expo Router 표준). 99개 초과는 '99+'
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        }}
      />
    </Tabs>
  );
}
