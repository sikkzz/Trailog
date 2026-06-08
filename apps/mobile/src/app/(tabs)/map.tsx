// (tabs)/map — 지도 탭. Phase 2 4.7 D2~D4 (지도 + 위치 + bbox 쿼리 + 사진 marker).
//
// =============================================================================
// 1. 라이브러리 선택 (ADR-0010)
// =============================================================================
//
// `@mj-studio/react-native-naver-map` v2.9.0 — 네이버맵 모바일 SDK wrapper.
// 이전 ADR-0009(react-native-maps) supersede 후 채택. 사유: Google/Apple Maps
// 한국 UX 거부감 + Trailog 도메인 한국 사용자 중심 재정의. 해외 사진은 Phase 후속.
//
// =============================================================================
// 2. NaverMap vs react-native-maps API 차이 (보편 RN 비교)
// =============================================================================
//
// 참조 코드 비교 X — 참조 (실무 웹)는 모바일 X. 보편 RN 표준 lib과만 비교:
//
// | 항목          | 네이버맵 (`NaverMapView`)                | react-native-maps (`MapView`)              |
// | ------------- | ---------------------------------------- | ------------------------------------------ |
// | 좌표 모델     | `camera={{ latitude, longitude, zoom }}` | `region={{ latitude, longitude, *delta }}` |
// | 초기 표시     | `initialCamera` (uncontrolled)           | `initialRegion`                            |
// | provider 옵션 | X (네이버 single)                        | Google/Apple/default 선택                  |
// | Marker        | `<NaverMapMarkerOverlay>` (overlay)      | `<Marker>` (직접 자식)                     |
// | ref 메서드    | `animateCameraTo` / `animateRegionTo`    | `animateToRegion` / `fitToCoordinates`     |
// | 권한 처리     | 별도 lib (`expo-location`) 권장          | `showsUserLocation` prop 활용              |
//
// → NaverMap은 **zoom 단위 좌표 모델** (구글지도/카카오 API와 일관),
//    react-native-maps는 delta(위경도 차이) 모델 — 직관성은 zoom이 ↑.
//
// =============================================================================
// 3. expo-location vs 보편 RN 위치 lib 비교
// =============================================================================
//
// | 항목         | expo-location (채택)                      | react-native-geolocation-service          |
// | ------------ | ----------------------------------------- | ----------------------------------------- |
// | Expo 호환    | ✅ 공식                                   | ⚠️ config plugin 별도                     |
// | 권한 API     | `requestForegroundPermissionsAsync()`     | iOS는 `requestAuthorization()` 별도       |
// | 위치 API     | `getCurrentPositionAsync(options)` async  | `getCurrentPosition(success, error)` cb   |
// | 정확도       | `Accuracy.Balanced/High/Highest` enum     | `enableHighAccuracy: boolean`             |
// | 권한 상태    | `granted` / `denied` / `undetermined`     | platform별 다름                           |
// | reverseGeo   | ✅ 내장 (`reverseGeocodeAsync` — D6 사용) | ❌ 별도 lib 필요                          |
//
// → expo-location 채택 — D6 reverseGeocode까지 한 lib 처리 + Expo 통합 안정.
//
// =============================================================================
// 4. 권한 흐름
// =============================================================================
//
//   Map 탭 mount
//        ↓
//   requestForegroundPermissionsAsync()
//        ↓ granted               ↓ denied
//   getCurrentPosition()         Seoul 유지 + banner UI (권한 재시도 / Settings)
//        ↓
//   ref.animateCameraTo(현재 위치, zoom 14)
//
// `let cancelled` lifecycle 패턴 — 4.6 index.tsx fix 패턴 일관 (Android race 방어).
//
// =============================================================================
// 5. bbox 쿼리 + Marker — D3c/D4 (현재)
// =============================================================================
//
// **`onCameraIdle` 자체 debounce**: 카메라 이동 끝나야 호출 — 사용자가 panning 중엔
// 발생 X. 별도 setTimeout debounce 불필요. region 인자에 south-west 좌표 +
// latitudeDelta/longitudeDelta 포함 → bbox `[minLng, minLat, maxLng, maxLat]` 변환.
//
// **bbox state → useMapPhotos hook → 백엔드 `GET /photos/map?bbox=...`**
// (PostGIS ST_Within + ST_MakeEnvelope, GIST 인덱스 자연 활용).
// React Query `placeholderData=keepPreviousData` → viewport 이동 중 이전 pin 유지 (flicker 방지).
//
// **Marker — `<NaverMapMarkerOverlay>`**: 기본 심볼 `red` 사용 (4.8 폴리시 wave에
// thumbnail icon 검토). `onTap` 클로저로 photo 캡쳐 → `router.push` photo detail.
// momentId도 함께 전달 — 4.6 D4d 화면이 momentId 필요 (단일 photo GET 백엔드 후속 박제).
//
// =============================================================================
// 6. Cluster — D5 (사진 묶음)
// =============================================================================
//
// NaverMap 자체 `clusters` prop 활용 — 외부 lib(supercluster.js 등) 불필요.
// 사진 수 적은 현재 시점에선 시각 효과 ↓이지만 사진 1000+ 시점부터 자연 발현.
//
// 동작:
// - 같은 cluster config의 ClusterMarkerProp 배열에 모든 사진 marker 박힘.
// - `screenDistance` px 이내 marker들이 자동으로 cluster 됨 (DBSCAN 비슷한 grid 기반).
// - `minZoom`/`maxZoom`은 cluster 적용 줌 범위.
// - 사용자가 cluster 탭 → 자동 zoom in. 충분히 zoom in되면 풀려서 단일 marker로.
// - 단일 marker 탭 → `onTapClusterLeaf({ markerIdentifier })` 콜백 → photo detail.
//
// 자식 `<NaverMapMarkerOverlay>` 방식과의 차이:
// - children marker: 카메라가 어디든 항상 노출. cluster X.
// - clusters prop: 자동 cluster + 줌별 노출/숨김. 사진 많을 때 성능 ↑ + 시인성 ↑.
//
// =============================================================================
// 7. 향후 (D7)
// =============================================================================
//
// - D7: 학습 노트 3건 (지도 lib 비교 / cluster 알고리즘 / PostGIS 공간 쿼리)

import { NaverMapView, type NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMapPhotos, type Bbox } from '../../lib/photos';

// 초기 카메라 위치 — 서울 시청 (한국 중심 도메인 + 친숙한 기준점)
const SEOUL_CITY_HALL = {
  latitude: 37.5665,
  longitude: 126.978,
  zoom: 12, // 서울 도심 ~10km 반경 정도 표시
};

// 현재 위치 확보 시 zoom (도심 한 블록 수준 — 사진 위치 핀 분간 가능)
const CURRENT_LOCATION_ZOOM = 14;

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<NaverMapViewRef>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);

  const { data: mapPhotosData } = useMapPhotos(bbox);

  // ClusterMarkerProp 배열 — photo.location 있는 것만, photo.id를 identifier로.
  // identifier로 onTapClusterLeaf 콜백에서 photo find → navigation.
  const clusterMarkers =
    mapPhotosData?.photos
      .filter((p) => p.location !== null)
      .map((p) => ({
        identifier: p.id,
        latitude: p.location!.latitude,
        longitude: p.location!.longitude,
        image: { symbol: 'red' as const },
        width: 28,
        height: 36,
      })) ?? [];

  const handleTapClusterLeaf = useCallback(
    ({ markerIdentifier }: { markerIdentifier: string }) => {
      const photo = mapPhotosData?.photos.find((p) => p.id === markerIdentifier);
      if (!photo) return;
      // typed routes — momentId query param 동봉 (4.6 D4d 화면 활용)
      router.push(`/photos/${photo.id}?momentId=${photo.momentId}` as never);
    },
    [mapPhotosData, router],
  );

  // 카메라 이동 끝나면 region(south-west + delta) → bbox [minLng, minLat, maxLng, maxLat]
  // onCameraIdle 자체 debounce — 별도 setTimeout 불필요.
  const handleCameraIdle = useCallback(
    (params: {
      region: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      };
    }) => {
      const { latitude, longitude, latitudeDelta, longitudeDelta } = params.region;
      setBbox([longitude, latitude, longitude + longitudeDelta, latitude + latitudeDelta]);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        setPermissionStatus(status);

        if (status !== Location.PermissionStatus.GRANTED) return;

        // Balanced — 100m 정확도, 배터리 적당. High는 GPS hot, Highest는 fix 시간 ↑.
        // 사진 지도 탭 진입 직후 view center 정도엔 Balanced 충분.
        //
        // Android Emulator 함정 (Phase 2 4.7 D2 디버깅 박제): `adb emu geo fix`는 GPS
        // provider만 mock하는데 expo-location은 fused_location_provider 사용 → cache된
        // default(Google HQ) 반환 가능. 실 디바이스/iOS는 정상.
        //
        // **D7 dev mock 우회**: __DEV__ + Android에서 mock 좌표(서울 시청) 직접 사용 —
        // emulator fused 함정 회피. production iOS/Android + 실 디바이스는 영향 X.
        // Trailog 도메인 한국 우선이라 서울 mock이 자연.
        const coords =
          __DEV__ && Platform.OS === 'android'
            ? { latitude: 37.5665, longitude: 126.978 }
            : (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
                .coords;
        if (cancelled) return;

        mapRef.current?.animateCameraTo({
          latitude: coords.latitude,
          longitude: coords.longitude,
          zoom: CURRENT_LOCATION_ZOOM,
        });
      } catch {
        // 위치 timeout/실패 — Seoul 기본 카메라 유지 (silent fallback).
        // banner는 권한 거부 시만 노출. 위치 자체 실패는 사용자 액션 없이 회복 어려움이라
        // 추가 UI X (Phase 후속 — 더 자연스러운 retry 흐름 검토).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRetryPermission(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status === Location.PermissionStatus.GRANTED) {
      // 권한 새로 받았으면 같은 흐름 — Android dev는 mock 좌표, 그 외는 실제 GPS
      const coords =
        __DEV__ && Platform.OS === 'android'
          ? { latitude: 37.5665, longitude: 126.978 }
          : (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
              .coords;
      mapRef.current?.animateCameraTo({
        latitude: coords.latitude,
        longitude: coords.longitude,
        zoom: CURRENT_LOCATION_ZOOM,
      });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <NaverMapView
        ref={mapRef}
        style={styles.map}
        initialCamera={SEOUL_CITY_HALL}
        isShowZoomControls
        isShowScaleBar
        isShowCompass
        onCameraIdle={handleCameraIdle}
        onTapClusterLeaf={handleTapClusterLeaf}
        clusters={[
          {
            markers: clusterMarkers,
            // 같은 화면 100px 안 marker들 cluster — 보편적 cluster 거리.
            // 사진 많아질 때 조절 (예: 50px = 더 잘게 / 150px = 더 큰 그룹).
            screenDistance: 100,
            // zoom level 0 ~ 16에서 cluster 적용 — 17+ 줌 인하면 풀려서 단일 marker.
            minZoom: 0,
            maxZoom: 16,
            animate: true,
          },
        ]}
      />
      {permissionStatus === Location.PermissionStatus.DENIED && (
        <View
          className="absolute bottom-6 left-4 right-4 bg-surface dark:bg-surface-dark rounded-lg p-4"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="font-pretendard-bold text-base text-text-primary dark:text-text-primary-dark mb-1">
            위치 권한이 거부되어 있어요
          </Text>
          <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-3">
            현재 위치를 지도에 표시하려면 권한이 필요해요.
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              className="flex-1 bg-primary py-2.5 rounded-md items-center active:opacity-70"
              onPress={handleRetryPermission}
            >
              <Text className="font-pretendard-semibold text-sm text-white">다시 요청</Text>
            </Pressable>
            <Pressable
              className="flex-1 bg-neutral-500 py-2.5 rounded-md items-center active:opacity-70"
              onPress={() => Linking.openSettings()}
            >
              <Text className="font-pretendard-semibold text-sm text-white">설정 열기</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
});
