// (tabs)/notifications — 알림 센터 (Phase 3 5.3 D3).
//
// 데이터: React Query 캐시 (`useNotifications`) — SSE로 도착한 payload 누적.
// 서버 영속화 X (in-memory 휘발) — 앱 재시작 시 초기화. Phase 4에 DB 영속화 검토
// (메모리 sse-phase4-enhancements-revisit).
//
// UI 정책:
// - 최근 순 (SSE 도착 순서)
// - 안읽음: 왼쪽 원형 dot + 진한 배경
// - 탭 시 읽음 처리 + 대상으로 이동 (photo.processed → moment 상세, share.viewed → moment 상세)
// - 빈 상태: 안내 문구만

import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../components/states';
import {
  useMarkNotificationRead,
  useNotifications,
  type NotificationItem,
} from '../../lib/notifications';

export default function NotificationsScreen() {
  const { data } = useNotifications();

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <View className="flex-row justify-between items-center px-5 py-4 border-b border-border dark:border-border-dark">
        <Text className="font-pretendard-bold text-2xl text-text-primary dark:text-text-primary-dark">
          알림
        </Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow item={item} />}
        ListEmptyComponent={<EmptyNotifications />}
        contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const router = useRouter();
  const markRead = useMarkNotificationRead();

  const handlePress = () => {
    markRead(item.id);
    // 대상으로 이동 — 두 payload 모두 momentId 또는 targetId로 moment 상세 진입
    if (item.payload.type === 'photo.processed') {
      router.push(`/moments/${item.payload.momentId}` as never);
    } else if (item.payload.type === 'share.viewed' && item.payload.target === 'moment') {
      router.push(`/moments/${item.payload.targetId}` as never);
    }
    // share.viewed + target=photo는 아직 photo 단독 route 진입 흐름 미정 — moment 진입 X
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-row items-start p-4 rounded-md border ${
        item.read
          ? 'border-border dark:border-border-dark bg-surface dark:bg-surface-dark'
          : 'border-primary bg-primary-50 dark:bg-primary-900'
      } active:opacity-80`}
      accessibilityRole="button"
      accessibilityLabel={`알림: ${formatTitle(item)}`}
      accessibilityState={{ selected: !item.read }}
    >
      {!item.read && (
        <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-2" accessibilityElementsHidden />
      )}
      <View className="flex-1">
        <Text
          className={`font-pretendard-${item.read ? 'medium' : 'semibold'} text-sm text-text-primary dark:text-text-primary-dark mb-0.5`}
        >
          {formatTitle(item)}
        </Text>
        <Text className="font-pretendard text-xs text-text-secondary dark:text-text-secondary-dark">
          {formatRelative(item.receivedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyNotifications() {
  return (
    <EmptyState
      title="아직 알림이 없어요"
      description="사진 처리 완료나 공유 링크가 조회되면 여기에 도착해요."
    />
  );
}

function formatTitle(item: NotificationItem): string {
  if (item.payload.type === 'photo.processed') {
    return item.payload.status === 'done' ? '사진 처리가 완료됐어요' : '사진 처리에 실패했어요';
  }
  // share.viewed
  return item.payload.target === 'photo' ? '공유한 사진이 열렸어요' : '공유한 Moment가 열렸어요';
}

/**
 * 상대 시간 표시 — Date-fns 미도입, 단순 계산.
 * "방금", "5분 전", "3시간 전", "2일 전"
 */
function formatRelative(epochMs: number): string {
  const diffSec = Math.floor((Date.now() - epochMs) / 1000);
  if (diffSec < 60) return '방금';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}
