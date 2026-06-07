# ADR-0009: 모바일 지도 라이브러리 — react-native-maps

> **상태**: ⚠️ **Superseded by [ADR-0010](./0010-mobile-map-library-naver-map.md)** (2026-06-07)
> **날짜**: 2026-06-06
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 2 Spec 4.7](../specs/phase-02-core-features.md), 학습 노트(예정) `mobile-map-libraries-comparison.md`

> **Supersede 사유 (2026-06-07)**: 본 ADR은 글로벌 도메인 가정으로 react-native-maps(Android = Google Maps + iOS = Apple Maps)를 채택했지만, 본인 검토 결과 **Google/Apple Maps의 한국 사용자 UX 거부감이 크다**는 본인 판단 + Trailog 도메인을 **한국 사용자 중심 + 해외는 Phase 후속**으로 재정의함에 따라 네이버맵으로 전환. 자세한 사유 + 도메인 재정의는 [ADR-0010](./0010-mobile-map-library-naver-map.md) 참고. 본 ADR은 **검토 자료로서 가치 유지** — react-native-maps 비교 + Google/Apple/MapLibre/expo-maps 시장 비교 부분은 미래 글로벌 출시 시점 또는 lib 재검토 시점에 참조 자산.

---

## 맥락 (Context)

Phase 2 4.7 "지도 표시" 진입. Trailog 도메인 정체성의 절반(사진 위치 시각화)을 담당하는 화면. 본인은 **모바일 지도 라이브러리 경험 0** — 학습 영역 #3(지도/데이터 시각화) 본격 진입 wave. RN 생태계 후보 3개 (expo-maps, react-native-maps, MapLibre) 중 첫 도입 lib을 결정해야 함.

## 결정 (Decision)

**선택**: `react-native-maps` (Airbnb maintained, RN 사실상 표준)

iOS는 Apple Maps, Android는 Google Maps native wrapper. Cluster는 외부 lib `react-native-map-clustering` (D5 진입 시 추가).

## 이유 / 트레이드오프

**이 선택으로 얻는 것**:

- **학습 자료 풍부함** — 본인 처음 접하는 영역. 8.5k+ stars, 튜토리얼/Stack Overflow 자료 가장 많음. 학습 효율 ↑
- **Cluster lib 안정** — `react-native-map-clustering`이 react-native-maps 의존이라 D5 cluster wave 자연 진입
- **RN 표준 정복** — 향후 RN 모든 지도 작업에 transfer되는 base 지식
- **1주 호흡 적합** — Phase 2 종료 빠른 진입 가능. 호흡 부담 ↓
- **iOS+Android 일관 API** — provider abstraction (`provider={PROVIDER_GOOGLE}` 옵션으로 통일 가능)
- **풍부한 컴포넌트** — Marker / Polyline / Polygon / Heatmap / Callout / Circle 등 사진 지도 도메인에 필요한 것 모두 기본 제공

**이 선택으로 포기하는 것**:

- **Vector tile + 커스텀 styling 깊이 정복 보류** — MapLibre는 OSS 풀스택(tile server / style spec)이라 그 영역 학습 가치 ↑. 4.8 폴리시 wave 또는 별도 wave에 미룸
- **Expo 공식 lib(expo-maps) 단순함 포기** — expo-maps가 SDK 버전 호환성 안정 ↑. 단 cluster 부재라 D5 friction
- **비용** — Android는 Google Maps API key 필요 (월 28,000 static maps 무료 → Trailog 1인 학습 규모는 무료 안에서 충분). MapLibre는 OSM tile로 완전 무료였을 것

**학습 가치 관점**:

- 본인이 처음 접하는 영역이라 **친숙 → 정복 전략** 부적합 (의도적 다양화 X — 비교 baseline 없음)
- RN 표준 lib 정복이 향후 모든 지도 작업에 transfer되는 베이스 — 학습 효율 ↑
- MapLibre의 vector tile / style 깊이 정복은 **베이스 이후 단계**가 자연스러움 (선형 학습 곡선)
- 참조 코드 비교 X — 참조 백엔드/프론트 모두 지도 사용 X (실무). 보편 RN 표준 따름 자연스러움

## 검토한 대안

| 대안                                                       | 장점                                                                                                                  | 단점                                                                                                    | 제외 이유                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A. `expo-maps` (Expo 공식, SDK 53+)                        | Expo 공식 → SDK 업그레이드 호환성 안정 / 셋업 단순 (config plugin 자동) / Apple Maps + Google Maps wrapper            | Cluster/Heatmap 기본 미지원 (직접 구현 또는 호환 lib 검증 필요) / 학습 자료 react-native-maps 대비 적음 | D5 cluster wave에서 friction 예상 — 단순함보다 cluster lib 안정이 우선                          |
| **B. `react-native-maps` (Airbnb)**                        | RN 사실상 표준, 자료 가장 풍부 / Cluster lib 안정 / Marker/Polyline/Polygon/Heatmap 등 풍부 / Expo config plugin 안정 | Expo 공식 X — SDK 메이저 업데이트 시 호환성 검증 필요 (Phase 4 운영 진입 시 인지 항목)                  | ✅ 채택                                                                                         |
| C. `@maplibre/maplibre-react-native` (Mapbox GL fork, OSS) | OSS 풀스택 / Vector tile + 자유 styling / Mapbox/Google 비용 회피 / 학습 가치 ↑↑                                      | 학습 곡선 ↑ / 자료 적음 / config plugin 별도 / 1주 호흡에 부담                                          | 1주 호흡 부담 ↑ + 첫 지도 도입에 over-engineering. 베이스 정복 후 styling 깊이 정복 단계로 미룸 |

## 결과 / 영향

**구조 변경**:

- 새 native module 추가 → Expo dev build 재빌드 필요 (1회). 본인 이미 expo-secure-store 등으로 경험 有 — 셋업 비용 ↓
- Android: Google Maps API key + app.json `android.config.googleMaps.apiKey` 필요. iOS: Apple Maps 무료 (key X)
- (tabs)/map 화면 D2 진입 시 native module mount 자연 검증

**의존성 추가**:

- `react-native-maps` (Marker / MapView 등 핵심)
- `react-native-map-clustering` (D5 시점 추가)
- `expo-location` (위치 권한 + reverseGeocodeAsync — D2/D6)

**향후 작업**:

- D2 — (tabs)/map 골격 + 위치 권한 + 기본 지도 표시
- D3 — 백엔드 bbox 쿼리 API (PostGIS `ST_Within` + `ST_MakeEnvelope` 자연 검증)
- D4 — pin + popup → photo detail navigation
- D5 — Cluster 활성화 (react-native-map-clustering)
- D6 — 사진 상세 미니맵 + reverseGeocodeAsync 주소 텍스트 ([4.6 D4d 박제](../specs/phase-02-core-features.md) 항목)
- D7 — 학습 노트 3건 (지도 lib 비교 / cluster 알고리즘 / PostGIS 공간 쿼리 실 사용)

## 재검토 트리거

이 결정을 다시 들여다봐야 할 조건:

1. **Expo SDK 메이저 업그레이드 시 (SDK 57+, 58+)** — react-native-maps 호환성 검증 필요. 깨지면 expo-maps 마이그레이션 검토
2. **사용자가 1000명+ 이상으로 늘어나 Google Maps API 비용 임계 진입 시** — MapLibre + 자체 OSM tile 또는 무료 tile provider 전환 검토
3. **커스텀 지도 스타일 / vector tile 학습 깊이 정복 wave 진입 시 (4.8 폴리시 wave 또는 별도 wave)** — MapLibre 병행 또는 마이그레이션 검토
4. **react-native-maps 유지보수 정체/중단 시** — 현재 Airbnb 관리지만 미래 보장 X. 정체 보이면 expo-maps 또는 MapLibre 마이그레이션 능동 검토

위 트리거 메모리 박제 — `mobile-map-library-revisit` (D1 종료 시점에 박제 예정).

## 참고

- [react-native-maps GitHub](https://github.com/react-native-maps/react-native-maps)
- [Expo react-native-maps 가이드](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [react-native-map-clustering](https://github.com/venits/react-native-map-clustering)
- [expo-maps (Expo 공식)](https://docs.expo.dev/versions/latest/sdk/maps/)
- [MapLibre RN](https://github.com/maplibre/maplibre-react-native)
- [Google Maps Platform 가격](https://mapsplatform.google.com/pricing/)
