// photos/[photoId] — 사진 상세 화면. Full-screen + takenAt + location.
//
// 참조 코드 비교 + RN 기본 문법은 login.tsx 헤더 참고. 이 화면의 추가 학습 포인트:
//   - `useLocalSearchParams<{photoId, momentId}>` — dynamic + query param 둘 다 받기
//   - `expo-image` `contentFit="contain"` — 비율 유지 + 배경 빈 공간 (Web의 object-fit: contain)
//   - 사진 데이터는 리스트 query 캐시 활용 (별도 fetch X) — Moment 상세와 동일 패턴
//   - 지도 link/표시는 Phase 2 4.7 (지도) 도입 후 정정
//
// momentId 없이 진입한 경우 (외부 deep link 등)는 후속에 백엔드 단일 photo GET 추가.

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMomentPhotos } from '../../lib/photos';

export default function PhotoDetailScreen() {
  const { photoId, momentId } = useLocalSearchParams<{
    photoId: string;
    momentId?: string;
  }>();
  const router = useRouter();
  const { data } = useMomentPhotos(momentId ?? '');
  const photo = data?.photos.find((p) => p.id === photoId);

  // 큰 사진은 large > medium > original 우선
  const imageUri =
    photo?.thumbnailUrls?.large ?? photo?.thumbnailUrls?.medium ?? photo?.originalUrl;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>닫기</Text>
        </Pressable>
        <Text style={styles.headerTitle}>사진</Text>
        <View style={{ width: 40 }} />
      </View>

      {photo && imageUri ? (
        <>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="contain"
              transition={200}
            />
          </View>
          <View style={styles.meta}>
            {photo.takenAt && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>촬영 시각</Text>
                <Text style={styles.metaValue}>{formatTakenAt(photo.takenAt)}</Text>
              </View>
            )}
            {photo.location && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>위치</Text>
                {/* TODO: Phase 2 4.7 지도 — raw lat/lng 대신 미니맵 + reverse geocoding(주소) */}
                <Text style={styles.metaValue}>
                  {photo.location.latitude.toFixed(4)}, {photo.location.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>업로드</Text>
              <Text style={styles.metaValue}>{photo.createdAt.slice(0, 10)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>처리 상태</Text>
              <Text style={[styles.metaValue, statusColor(photo.processingStatus)]}>
                {statusLabel(photo.processingStatus)}
              </Text>
            </View>
            {!photo.takenAt && !photo.location && (
              <Text style={styles.metaHint}>EXIF 정보가 없는 사진입니다 (스크린샷 등)</Text>
            )}
          </View>
        </>
      ) : (
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>사진을 찾을 수 없습니다</Text>
          {!momentId && <Text style={styles.notFoundHint}>(momentId 없이 진입 — Phase 후속)</Text>}
        </View>
      )}
    </SafeAreaView>
  );
}

/** ISO 8601 → 'YYYY-MM-DD HH:MM' (사용자 친화). */
function formatTakenAt(iso: string): string {
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return `${date} ${time}`;
}

function statusLabel(status: 'pending' | 'done' | 'failed'): string {
  if (status === 'pending') return '처리 중';
  if (status === 'failed') return '처리 실패';
  return '완료';
}

function statusColor(status: 'pending' | 'done' | 'failed') {
  if (status === 'pending') return { color: '#1a73e8' };
  if (status === 'failed') return { color: '#e53935' };
  return { color: '#2e7d32' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  close: { fontSize: 16, color: '#fff' },
  headerTitle: { fontSize: 16, color: '#fff', fontWeight: '600' },
  imageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  meta: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 16 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: { fontSize: 13, color: '#888' },
  metaValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  metaHint: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 6 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: '#888' },
  notFoundHint: { fontSize: 12, color: '#555', marginTop: 8 },
});
