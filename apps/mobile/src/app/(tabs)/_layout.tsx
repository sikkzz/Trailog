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
import { useColorScheme } from 'react-native';

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
    </Tabs>
  );
}
