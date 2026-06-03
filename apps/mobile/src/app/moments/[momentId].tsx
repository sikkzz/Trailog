// moments/[momentId] — Moment 상세 화면. Moment 정보 + 사진 grid.
//
// 참조 코드 비교 + RN 기본 문법은 login.tsx 헤더 참고. 이 화면에서 새로 등장하는 것:
//
// =============================================================================
// RN 기본 문법 추가 해설
// =============================================================================
//
// | RN 컴포넌트/패턴             | 의미                                                                |
// | ---------------------------- | ------------------------------------------------------------------- |
// | `<Image source={{uri}}>`     | RN built-in. source는 객체 (`{uri}` / `require()`)                  |
// | `expo-image` `<Image>`       | expo 권장 — 캐시 자동 + blurhash + transition + better perf         |
// | `FlatList numColumns={3}`    | 3열 grid (CSS Grid 직접 없음 — FlatList의 numColumns로 grid 흉내)   |
// | `Dimensions.get('window')`   | 화면 크기 — grid item width 계산 (web의 viewport 대응)              |
// | `aspectRatio: 1`             | 정사각 비율 (web의 aspect-ratio CSS와 동일)                         |
//
// =============================================================================
// processingStatus 분기 UI (Phase 2 4.4 도입)
// =============================================================================
//
//   - 'done'    → thumbnailUrls.small (정상 grid card)
//   - 'pending' → originalUrl + "처리 중" overlay (사용자 대기 안내)
//   - 'failed'  → originalUrl + "처리 실패" overlay (재시도는 Phase 후속)
//
// 업로드 버튼은 D4c에서 expo-image-picker 적용. 현재는 placeholder.

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMoments } from '../../lib/moments';
import { useMomentPhotos, type PhotoListItem } from '../../lib/photos';

const GRID_COLUMNS = 3;
const GRID_GAP = 4;
// 화면 width - 양쪽 padding(16*2) - 사이 gap(2) = item 3개
const ITEM_SIZE =
  (Dimensions.get('window').width - 32 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function MomentDetailScreen() {
  const { momentId } = useLocalSearchParams<{ momentId: string }>();
  const router = useRouter();
  const { data: momentsData } = useMoments();
  const moment = momentsData?.moments.find((m) => m.id === momentId);
  const {
    data: photosData,
    isLoading: photosLoading,
    isError: photosError,
    refetch: refetchPhotos,
    isRefetching,
  } = useMomentPhotos(momentId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← 뒤로</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            // D4c — expo-image-picker 흐름
          }}
          style={({ pressed }) => [styles.uploadButton, pressed && styles.uploadButtonPressed]}
        >
          <Text style={styles.uploadButtonText}>＋ 사진</Text>
        </Pressable>
      </View>

      {moment ? (
        <View style={styles.momentInfo}>
          <Text style={styles.title}>{moment.title}</Text>
          {moment.startedAt && (
            <Text style={styles.meta}>시작: {moment.startedAt.slice(0, 10)}</Text>
          )}
          {moment.endedAt && <Text style={styles.meta}>종료: {moment.endedAt.slice(0, 10)}</Text>}
          <Text style={styles.meta}>작성: {moment.createdAt.slice(0, 10)}</Text>
        </View>
      ) : (
        <View style={styles.momentInfo}>
          <Text style={styles.notFound}>Moment를 찾을 수 없습니다 (id={momentId})</Text>
        </View>
      )}

      {photosLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : photosError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>사진을 불러오지 못했어요</Text>
          <Pressable onPress={() => refetchPhotos()} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={photosData?.photos ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PhotoGridItem photo={item} />}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          ListEmptyComponent={<EmptyPhotos />}
          onRefresh={() => refetchPhotos()}
          refreshing={isRefetching}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * 단일 사진 grid item.
 * processingStatus 분기:
 *   - 'done' → thumbnailUrls.small (없으면 originalUrl)
 *   - 'pending'/'failed' → originalUrl + overlay
 */
function PhotoGridItem({ photo }: { photo: PhotoListItem }) {
  // 썸네일이 있으면 small 우선, 없으면 원본 (큰 이미지 — 트래픽 ↑ but 표시 가능)
  const imageUri = photo.thumbnailUrls?.small ?? photo.originalUrl;
  const showOverlay = photo.processingStatus !== 'done';

  return (
    <Pressable style={styles.gridItem}>
      <Image
        source={{ uri: imageUri }}
        style={styles.gridImage}
        contentFit="cover"
        transition={200}
      />
      {showOverlay && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {photo.processingStatus === 'pending' ? '처리 중…' : '처리 실패'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptyPhotos() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>아직 사진이 없어요</Text>
      <Text style={styles.emptySubtitle}>우측 상단 ＋ 사진 버튼으로{'\n'}첫 사진을 올려보세요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  back: { fontSize: 16, color: '#1a73e8' },
  uploadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a73e8',
    borderRadius: 16,
  },
  uploadButtonPressed: { backgroundColor: '#155cb0' },
  uploadButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  momentInfo: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  meta: { fontSize: 13, color: '#666', marginBottom: 2 },
  notFound: { fontSize: 14, color: '#888' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#e53935', marginBottom: 16 },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  gridContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  row: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: {
    width: ITEM_SIZE,
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  gridImage: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, color: '#555', marginBottom: 8, fontWeight: '500' },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
});
