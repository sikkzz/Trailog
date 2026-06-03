// Phase 2 4.6 D1 — 임시 검증 화면. D2에서 인증 분기 redirect로 대체.
// 각 라우트 진입 버튼으로 라우트 골격 + Expo Router 동작 검증.
//
// `as Href` cast 사유: typed routes는 typegen 결과 (`.expo/types/router.d.ts`)에 의존하고,
// typegen은 dev server 첫 부팅 시 자동 생성. D1 초기엔 typegen 없어서 모든 Link href type fail.
// 검증용 임시 화면이라 cast로 우회. D2/D3에서 typedRoutes 다시 활성 + typegen 정상화 시 제거.

import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Trailog</Text>
        <Text style={styles.subtitle}>a trail of your moments</Text>

        <View style={styles.routeList}>
          <Text style={styles.section}>D1 라우트 검증</Text>
          <Link href={'/(auth)/login' as Href} style={styles.link}>
            → (auth)/login
          </Link>
          <Link href={'/(auth)/signup' as Href} style={styles.link}>
            → (auth)/signup
          </Link>
          <Link href={'/(tabs)/moments' as Href} style={styles.link}>
            → (tabs)/moments
          </Link>
          <Link href={'/(tabs)/map' as Href} style={styles.link}>
            → (tabs)/map
          </Link>
          <Link href={'/moments/test-moment-id' as Href} style={styles.link}>
            → moments/[momentId]
          </Link>
          <Link href={'/photos/test-photo-id' as Href} style={styles.link}>
            → photos/[photoId]
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 24 },
  title: { fontSize: 40, fontWeight: '700', color: '#1a1a1a', marginTop: 32 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32, fontStyle: 'italic' },
  routeList: { gap: 12 },
  section: { fontSize: 12, color: '#999', marginBottom: 8, textTransform: 'uppercase' },
  link: { fontSize: 16, color: '#1a73e8', paddingVertical: 8 },
});
