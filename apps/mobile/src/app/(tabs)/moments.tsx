// (tabs)/moments — 본인의 Moment 리스트.
//
// 참조 코드 비교 + RN 기본 문법 해설은 login.tsx 헤더 참고.
// 이 화면에서 새로 등장하는 RN 컴포넌트:
//   - `<FlatList>` — 대량 데이터 가상화 리스트. `data` + `renderItem` + `keyExtractor`
//     · web의 .map() 대응이지만 화면 밖 item은 unmount → 메모리 ↓
//     · 작은 리스트(<20)는 .map도 OK. Moment 수 모르므로 FlatList 안전 채택
//   - `ListEmptyComponent` — data 빈 배열일 때 자동 렌더 (empty state)
//   - `<ActivityIndicator>` — loading spinner
//
// React Query 패턴:
//   - useMoments() — queryKey 'moments/list', staleTime 30초 (query-client 글로벌 설정)
//   - 자동 캐싱 + refetchOnReconnect 자동
//   - mutation으로 invalidate 시 자동 refetch

import { Link, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMoments, type Moment } from '../../lib/moments';

export default function MomentsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMoments();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moments</Text>
        <Pressable
          onPress={() => router.push('/moments/create' as never)}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            불러오는 중 오류가 발생했어요
            {'\n'}
            {error instanceof Error ? error.message : ''}
          </Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.moments ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MomentCard moment={item} />}
          ListEmptyComponent={<EmptyMoments />}
          contentContainerStyle={styles.listContent}
          onRefresh={() => refetch()}
          refreshing={isRefetching}
        />
      )}
    </SafeAreaView>
  );
}

/** 단일 Moment 카드 — title + 시간 정보. 탭 시 상세 화면. */
function MomentCard({ moment }: { moment: Moment }) {
  return (
    <Link href={`/moments/${moment.id}` as never} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <Text style={styles.cardTitle}>{moment.title}</Text>
        <Text style={styles.cardSubtitle}>{formatMomentRange(moment)}</Text>
      </Pressable>
    </Link>
  );
}

/** Moment 없을 때 empty state — "+" 안내. */
function EmptyMoments() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>아직 박제된 순간이 없어요</Text>
      <Text style={styles.emptySubtitle}>우측 상단 ＋ 버튼으로{'\n'}첫 Moment를 만들어보세요</Text>
    </View>
  );
}

/**
 * Moment 시간 범위 포맷:
 *  - startedAt + endedAt 둘 다 → "YYYY-MM-DD ~ YYYY-MM-DD"
 *  - startedAt만 → "YYYY-MM-DD"
 *  - 둘 다 없음 → createdAt fallback (작성 시각)
 */
function formatMomentRange(moment: Moment): string {
  const fmt = (iso: string): string => iso.slice(0, 10);
  if (moment.startedAt && moment.endedAt) {
    return `${fmt(moment.startedAt)} ~ ${fmt(moment.endedAt)}`;
  }
  if (moment.startedAt) {
    return fmt(moment.startedAt);
  }
  return `${fmt(moment.createdAt)} 작성`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { backgroundColor: '#155cb0' },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: '600', lineHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#e53935', textAlign: 'center', marginBottom: 16 },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listContent: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardPressed: { backgroundColor: '#eef2f7' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#666' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, color: '#555', marginBottom: 8, fontWeight: '500' },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
});
