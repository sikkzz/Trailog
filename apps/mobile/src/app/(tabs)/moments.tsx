// (tabs)/moments — 본인의 Moment 리스트.
//
// 참조 코드 비교 + RN 기본 문법 해설은 login.tsx 헤더 참고.
// Phase 2 4.8 D3-4 — StyleSheet → NativeWind 마이그레이션 (ADR-0011).
//
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
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMoments, type Moment } from '../../lib/moments';

export default function MomentsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMoments();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <View className="flex-row justify-between items-center px-5 py-4 border-b border-border dark:border-border-dark">
        <Text className="font-pretendard-bold text-2xl text-text-primary dark:text-text-primary-dark">
          Moments
        </Text>
        <Pressable
          onPress={() => router.push('/moments/create' as never)}
          className="w-9 h-9 rounded-full bg-primary items-center justify-center active:opacity-80"
        >
          <Text className="font-pretendard-semibold text-xl text-white leading-6">＋</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="font-pretendard text-sm text-danger text-center mb-4">
            불러오는 중 오류가 발생했어요
            {'\n'}
            {error instanceof Error ? error.message : ''}
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="px-5 py-2.5 bg-primary rounded-md active:opacity-80"
          >
            <Text className="font-pretendard-semibold text-sm text-white">다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.moments ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MomentCard moment={item} />}
          ListEmptyComponent={<EmptyMoments />}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
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
      <Pressable className="bg-surface dark:bg-surface-dark rounded-lg p-4 border border-border dark:border-border-dark active:opacity-80">
        <Text className="font-pretendard-semibold text-lg text-text-primary dark:text-text-primary-dark mb-1">
          {moment.title}
        </Text>
        <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark">
          {formatMomentRange(moment)}
        </Text>
      </Pressable>
    </Link>
  );
}

/** Moment 없을 때 empty state — "+" 안내. */
function EmptyMoments() {
  return (
    <View className="flex-1 items-center justify-center p-10">
      <Text className="font-pretendard-medium text-base text-text-secondary dark:text-text-secondary-dark mb-2">
        아직 박제된 순간이 없어요
      </Text>
      <Text className="font-pretendard text-sm text-text-tertiary dark:text-text-tertiary-dark text-center leading-5">
        우측 상단 ＋ 버튼으로{'\n'}첫 Moment를 만들어보세요
      </Text>
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
