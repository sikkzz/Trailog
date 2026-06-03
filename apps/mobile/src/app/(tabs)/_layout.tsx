// (tabs)/_layout — 인증 후 메인 탭 layout.
//
// 탭 구성:
//   - moments: Moment 리스트 (메인)
//   - map: 지도 탭 (4.7에 채움)
//
// 참조 (Next.js App Router (group)) 패턴 일관 — 인증 상태 기반 layout 분리.

import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="moments" options={{ title: 'Moments' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
    </Tabs>
  );
}
