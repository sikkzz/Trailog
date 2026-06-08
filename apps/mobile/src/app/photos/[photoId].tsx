// photos/[photoId] — 사진 상세 화면. Full-screen + 미니맵 + 한국어 주소.
//
// Phase 2 4.8 D3-6 — StyleSheet → NativeWind 마이그레이션 (ADR-0011).
// 사진 상세는 **항상 검정 톤 유지** (Instagram/Apple Photos 패턴 — 사진 강조) —
// 다크모드 prefix 불필요. 라이트/다크 모드와 무관.
//
// =============================================================================
// 1. 화면 구성
// =============================================================================
//
// 1. Header (닫기 / 사진 title) — 검정
// 2. 큰 사진 (expo-image `contentFit="contain"` — 비율 유지)
// 3. 미니맵 (location 있을 때만 — NaverMap 정적 + marker)
// 4. meta 섹션 — 촬영 시각 / 위치 주소 / 업로드 / 처리 상태
//
// =============================================================================
// 2. reverse geocoding — 백엔드 NCP proxy
// =============================================================================
//
// OS별 reverseGeocode 차이 통일 — `useReverseGeocode(photo.location)` 한 줄.
// 도로명 우선 / 지번 fallback / 대기 중 raw 좌표 fallback.

import { NaverMapMarkerOverlay, NaverMapView } from '@mj-studio/react-native-naver-map';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
  const { data: geocodeData } = useReverseGeocode(photo?.location ?? null);
  const address = geocodeData?.address ?? null;

  const imageUri =
    photo?.thumbnailUrls?.large ?? photo?.thumbnailUrls?.medium ?? photo?.originalUrl;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row justify-between items-center px-5 py-3 bg-black/90">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Text className="font-pretendard text-base text-white">닫기</Text>
        </Pressable>
        <Text className="font-pretendard-semibold text-base text-white">사진</Text>
        <View className="w-10" />
      </View>

      {photo && imageUri ? (
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="h-[400px] items-center justify-center bg-black">
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              transition={200}
            />
          </View>

          {photo.location && (
            <View className="h-[200px] bg-neutral-900">
              <NaverMapView
                style={{ flex: 1 }}
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

          <View className="bg-neutral-900 px-5 py-4">
            {photo.takenAt && (
              <View className="flex-row justify-between items-start py-1.5 gap-3">
                <Text className="font-pretendard text-sm text-neutral-400 min-w-[70px]">
                  촬영 시각
                </Text>
                <Text className="font-pretendard-medium text-sm text-white flex-1 text-right">
                  {formatTakenAt(photo.takenAt)}
                </Text>
              </View>
            )}
            {photo.location && (
              <View className="flex-row justify-between items-start py-1.5 gap-3">
                <Text className="font-pretendard text-sm text-neutral-400 min-w-[70px]">위치</Text>
                <Text
                  className="font-pretendard-medium text-sm text-white flex-1 text-right"
                  numberOfLines={2}
                >
                  {address ?? formatLocation(photo.location)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between items-start py-1.5 gap-3">
              <Text className="font-pretendard text-sm text-neutral-400 min-w-[70px]">업로드</Text>
              <Text className="font-pretendard-medium text-sm text-white flex-1 text-right">
                {photo.createdAt.slice(0, 10)}
              </Text>
            </View>
            <View className="flex-row justify-between items-start py-1.5 gap-3">
              <Text className="font-pretendard text-sm text-neutral-400 min-w-[70px]">
                처리 상태
              </Text>
              <Text
                className={`font-pretendard-medium text-sm flex-1 text-right ${statusColorClass(photo.processingStatus)}`}
              >
                {statusLabel(photo.processingStatus)}
              </Text>
            </View>
            {!photo.takenAt && !photo.location && (
              <Text className="font-pretendard text-xs italic text-neutral-500 mt-1.5">
                EXIF 정보가 없는 사진입니다 (스크린샷 등)
              </Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="font-pretendard text-base text-neutral-400">
            사진을 찾을 수 없습니다
          </Text>
          {!momentId && (
            <Text className="font-pretendard text-xs text-neutral-600 mt-2">
              (momentId 없이 진입 — Phase 후속)
            </Text>
          )}
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

function statusColorClass(status: 'pending' | 'done' | 'failed'): string {
  if (status === 'pending') return 'text-info';
  if (status === 'failed') return 'text-danger';
  return 'text-success';
}
