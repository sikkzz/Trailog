// photos/[photoId] — 사진 상세 화면. Full-screen + takenAt + 미니맵 + 주소.
//
// =============================================================================
// 1. 화면 구성 (D6 박제)
// =============================================================================
//
// 1. Header (닫기 / 사진 title)
// 2. 큰 사진 (expo-image `contentFit="contain"` — 비율 유지 + 배경 빈 공간)
// 3. 미니맵 (location 있을 때만 — NaverMap 정적, interaction X) + marker 1개
// 4. meta 섹션 — 촬영 시각 / 위치 주소 / 업로드 / 처리 상태
//
// =============================================================================
// 2. reverse geocoding — 백엔드 proxy (NCP Reverse Geocoding)
// =============================================================================
//
// 4.6 D4d 박제 항목 — raw lat/lng(`63.5314, -19.5112`)는 사용자가 못 읽음.
// 처음엔 `expo-location.reverseGeocodeAsync` 시도했지만 **OS별 결과 차이 큼**:
//   - iOS Apple Geocoding: "서울특별시 태평로1가 세종대로 서울특별시청" (region/street/name 채움)
//   - Android Google Geocoding: "서울특별시 중구 태평로1가 31" (region/city/district/street/streetNumber)
//   같은 좌표인데 채워지는 field가 다름 → form 통일 X.
//
// **해결책**: 백엔드 proxy + NCP Reverse Geocoding (단일 API → OS 무관 통일 + 한국어 보장).
//   - GET /geocode/reverse?lat=&lng= (`apps/server/src/geocoding/`)
//   - 도로명 주소 우선("서울특별시 중구 세종대로 110 (서울특별시청)"), 지번 fallback
//   - React Query staleTime: Infinity — 좌표 주소 영구 캐시
//
// =============================================================================
// 3. 미니맵 (정적)
// =============================================================================
//
// - NaverMap initialCamera = 사진 위치 + zoom 15 (도심 한 블록)
// - Marker 1개 (사진 위치)
// - 모든 gesture 비활성화 (사용자 큰 지도 보고 싶으면 Map 탭 진입)
// - 미니맵 자체는 ADR-0010 네이버맵 lib 활용 — 큰 지도와 일관

import { NaverMapMarkerOverlay, NaverMapView } from '@mj-studio/react-native-naver-map';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReverseGeocode } from '../../lib/geocoding';
import { useMomentPhotos, type PhotoLocation } from '../../lib/photos';

export default function PhotoDetailScreen() {
  const { photoId, momentId } = useLocalSearchParams<{
    photoId: string;
    momentId?: string;
  }>();
  const router = useRouter();
  const { data } = useMomentPhotos(momentId ?? '');
  const photo = data?.photos.find((p) => p.id === photoId);

  // 백엔드 NCP proxy로 단일 한국어 주소 — OS 차이 없음.
  // 대기 중/실패면 address null → raw 좌표 fallback.
  const { data: geocodeData } = useReverseGeocode(photo?.location ?? null);
  const address = geocodeData?.address ?? null;

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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="contain"
              transition={200}
            />
          </View>

          {photo.location && (
            <View style={styles.miniMapContainer}>
              <NaverMapView
                style={styles.miniMap}
                initialCamera={{
                  latitude: photo.location.latitude,
                  longitude: photo.location.longitude,
                  zoom: 15,
                }}
                isScrollGesturesEnabled={false}
                isZoomGesturesEnabled={false}
                isRotateGesturesEnabled={false}
                isTiltGesturesEnabled={false}
                isStopGesturesEnabled={false}
              >
                <NaverMapMarkerOverlay
                  latitude={photo.location.latitude}
                  longitude={photo.location.longitude}
                  image={{ symbol: 'red' }}
                  width={28}
                  height={36}
                />
              </NaverMapView>
            </View>
          )}

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
                <Text style={styles.metaValue} numberOfLines={2}>
                  {address ?? formatLocation(photo.location)}
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
        </ScrollView>
      ) : (
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>사진을 찾을 수 없습니다</Text>
          {!momentId && <Text style={styles.notFoundHint}>(momentId 없이 진입 — Phase 후속)</Text>}
        </View>
      )}
    </SafeAreaView>
  );
}

/** reverse geocode 실패/대기 fallback — raw 좌표 4자리. */
function formatLocation(location: PhotoLocation): string {
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
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
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  imageContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  image: { width: '100%', height: '100%' },
  miniMapContainer: {
    height: 200,
    backgroundColor: '#111',
  },
  miniMap: { flex: 1 },
  meta: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 16 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 12,
  },
  metaLabel: { fontSize: 13, color: '#888', minWidth: 70 },
  metaValue: { fontSize: 14, color: '#fff', fontWeight: '500', flex: 1, textAlign: 'right' },
  metaHint: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 6 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: '#888' },
  notFoundHint: { fontSize: 12, color: '#555', marginTop: 8 },
});
