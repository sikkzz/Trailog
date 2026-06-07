// (tabs)/map — 지도 탭. Phase 2 4.7 D2b 위치 권한 + 현재 위치 center.
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
// 5. D2 이후 (다음 단계)
// =============================================================================
//
// - D3: 백엔드 `GET /photos?bbox=...` 또는 `/photos/with-location` (PostGIS ST_Within)
// - D4: 본인 사진 location → `<NaverMapMarkerOverlay>` pin + 클릭 popup → photo detail
// - D5: Cluster (네이버맵 자체 cluster 지원 검증 또는 외부 lib/직접 구현)

import { NaverMapView, type NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 초기 카메라 위치 — 서울 시청 (한국 중심 도메인 + 친숙한 기준점)
const SEOUL_CITY_HALL = {
  latitude: 37.5665,
  longitude: 126.978,
  zoom: 12, // 서울 도심 ~10km 반경 정도 표시
};

// 현재 위치 확보 시 zoom (도심 한 블록 수준 — 사진 위치 핀 분간 가능)
const CURRENT_LOCATION_ZOOM = 14;

export default function MapScreen() {
  const mapRef = useRef<NaverMapViewRef>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) return;

      // Balanced — 100m 정확도, 배터리 적당. High는 GPS hot, Highest는 fix 시간 ↑.
      // 사진 지도 탭 진입 직후 view center 정도엔 Balanced 충분.
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;

      mapRef.current?.animateCameraTo({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        zoom: CURRENT_LOCATION_ZOOM,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRetryPermission(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status === Location.PermissionStatus.GRANTED) {
      // 권한 새로 받았으면 같은 흐름 — 현재 위치 가져와 카메라 이동
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current?.animateCameraTo({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
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
      />
      {permissionStatus === Location.PermissionStatus.DENIED && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>위치 권한이 거부되어 있어요</Text>
          <Text style={styles.bannerDesc}>현재 위치를 지도에 표시하려면 권한이 필요해요.</Text>
          <View style={styles.bannerActions}>
            <Pressable
              style={({ pressed }) => [styles.bannerButton, pressed && styles.bannerButtonPressed]}
              onPress={handleRetryPermission}
            >
              <Text style={styles.bannerButtonText}>다시 요청</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.bannerButton,
                styles.bannerButtonSecondary,
                pressed && styles.bannerButtonPressed,
              ]}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.bannerButtonText}>설정 열기</Text>
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
  banner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  bannerDesc: { fontSize: 13, color: '#666', marginBottom: 12 },
  bannerActions: { flexDirection: 'row', gap: 8 },
  bannerButton: {
    flex: 1,
    backgroundColor: '#1a73e8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  bannerButtonSecondary: { backgroundColor: '#888' },
  bannerButtonPressed: { opacity: 0.7 },
  bannerButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
