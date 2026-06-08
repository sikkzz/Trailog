// 진입 라우트 — 인증 상태 분기 redirect.
//
// 흐름:
//   1. authStorage.getTokens()로 secure-store 확인 (Phase 2 4.1에 박힘)
//   2. tokens 있음 → /(tabs)/moments (메인)
//   3. tokens 없음 → /(auth)/login
//
// =============================================================================
// 참조 (Next.js Web) 비교
// =============================================================================
//
// - 회사: middleware.ts에서 cookie 검사 후 redirect (SSR + middleware)
// - Trailog (RN): expo-secure-store 비동기 read + useEffect → router.replace
//   (모바일은 middleware 자체 X — 항상 클라 진입 후 분기)
//
// =============================================================================
// RN 기본 문법 해설 (이 화면에서 새로 등장)
// =============================================================================
//
// - `<ActivityIndicator>` = web의 spinner 라이브러리 대응. RN built-in.
//   `size="large"` / `color="..."` 만. 단순 로딩 표시.
// - 자세한 RN 컴포넌트 비교는 login.tsx 헤더 + D5 학습 노트 참고.
//
// =============================================================================
// `as never` cast 사유
// =============================================================================
//
// typed routes typegen이 dev server 첫 부팅 시 생성됨 — D1 시점엔 type 부정확.
// D3 이후 안정화되면 cast 제거.

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { authStorage } from '../lib/auth';

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // checking state 별도 추적 X — replace 호출되면 화면 자동 전환되므로 불필요.
    // 이전엔 setChecking(false)가 unmount 시점과 race → Android에서 react warning 발생.
    let cancelled = false;
    authStorage
      .getTokens()
      .then((tokens) => {
        if (cancelled) return;
        router.replace((tokens ? '/(tabs)/moments' : '/(auth)/login') as never);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace('/(auth)/login' as never);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 분기 결정 전 짧은 로딩 (대부분 ms 단위 — router.replace 후 화면 자동 전환).
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <ActivityIndicator size="large" className="text-primary" />
    </View>
  );
}
