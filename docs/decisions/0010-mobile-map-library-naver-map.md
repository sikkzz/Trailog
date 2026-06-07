# ADR-0010: 모바일 지도 라이브러리 — 네이버맵 (`@mj-studio/react-native-naver-map`)

> **상태**: Accepted (Supersedes [ADR-0009](./0009-mobile-map-library-react-native-maps.md))
> **날짜**: 2026-06-07
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 2 Spec 4.7](../specs/phase-02-core-features.md), [ADR-0009 (superseded)](./0009-mobile-map-library-react-native-maps.md), 학습 노트(예정) `mobile-map-libraries-comparison.md`

---

## 맥락 (Context)

ADR-0009에서 `react-native-maps` 채택 직후 본인 검토에서 다음 두 가지가 명확해짐:

1. **Google Maps / Apple Maps의 한국 사용자 UX 거부감**이 본인 판단으로 큼 — 한국 도보 길/지명 검색 약점 + 본인 일상 지도 사용 친숙도 ↓
2. **Trailog 도메인의 사용자 우선순위 재정의** — 본인 + 한국 사용자 중심 MVP. "여행"도 한국 사용자 관점이 우선. 해외 EXIF 사진은 Phase 후속(글로벌 출시 검토 시점)

위 두 가지가 글로벌 도메인 가정의 ADR-0009를 fundamental하게 변경시킴 → supersede.

## 결정 (Decision)

**선택**: `@mj-studio/react-native-naver-map` (v2.9.0, MIT, Naver Cloud Platform 모바일 다이나믹 지도)

Trailog 도메인을 **한국 사용자 중심**으로 재정의. 해외 사진의 지도 표시는 Phase 후속(글로벌 출시 시점)으로 미룸.

## 이유 / 트레이드오프

**이 선택으로 얻는 것**:

- **한국 사용자 UX 친숙도** — 네이버맵은 한국 운전 길찾기 + 위치 인프라 ↑. 본인 + 사용자가 이미 일상에서 쓰는 친숙한 인터페이스 그대로
- **한국 도로/지명 정확도** — 한국 지명 검색 + 도로 데이터가 Google/Apple 대비 우위 (한국 자체 데이터)
- **RN + Expo 통합 안정** — `@mj-studio/react-native-naver-map` v2.9.0이 **New Architecture (Fabric) 호환 명시** + Expo config plugin 공식 제공. SDK 56 + Expo CNG 안전
- **무료 한도 ↑** — Naver Cloud Platform 모바일 dynamic map은 사실상 무제한 무료 (인증 키만 발급)
- **실무 가치** — 한국 시장 RN 앱 개발 시 네이버/카카오 SDK 정복은 실무 transfer 가치 ↑

**이 선택으로 포기하는 것**:

- **해외 사진 정확도** — 일본/유럽 등 해외 GPS 사진은 핀 표시가 부정확하거나 데이터 부족. 본인 모든 사진의 위치를 정밀하게 보려는 케이스에선 약점. Phase 후속(글로벌 출시 시점)에 글로벌 lib 추가 또는 multi-provider 검토 필요
- **RN 사실상 표준 lib 정복 보류** — react-native-maps는 RN 모든 지도 작업의 베이스 정복 가치 ↑. 단 한국 시장 우선이면 lib 종속성 변경이 정당. 후속 글로벌 출시 시점에 추가 정복 가능
- **iOS Apple Maps 카카오 tile 활용 기회 X** — Apple Maps의 한국 카카오 tile은 OK이지만 본인이 Apple Maps 인터페이스 자체 거부감이 있다고 명시 → 무의미

**학습 가치 관점**:

- **한국 시장 모바일 지도 SDK 정복** — 실무 transfer 가치 ↑ (시장 점유율 1위 카카오 + 2위 네이버 두 SDK 중 RN/Expo 호환성 ↑인 네이버 우선 정복)
- **Expo config plugin 깊이 정복** — 네이버맵 + expo-build-properties(Maven repository 주입) 조합 학습은 향후 third-party native SDK 통합의 표준 패턴 정복
- **참조 코드 비교** — 참조 백엔드/프론트 모두 지도 사용 X (실무). 보편 한국 모바일 표준 따름이 자연스러움

## 검토한 대안

| 대안                                | 장점                                                  | 단점                                                                                  | 제외 이유                                                                                  |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `react-native-maps` (ADR-0009)      | RN 표준, 자료 풍부, Cluster lib 안정                  | Android = Google Maps 강제 / iOS Apple Maps의 한국 UX는 카카오 tile이지만 본인 거부감 | 본인 UX 거부감 + 한국 우선 도메인과 fundamental 충돌                                       |
| `@mj-studio/react-native-naver-map` | **한국 친숙 + RN/Expo 안정 + 무료 ↑ + New Arch 호환** | 해외 데이터 약함 / Naver Cloud 본인 인증 필요                                         | ✅ 채택                                                                                    |
| 카카오맵 RN community lib           | 한국 1위 친숙도                                       | 공식 RN SDK X / community lib 유지보수 불안정 / Expo 통합 비공식                      | 안정성 검증 부담 ↑. 학습 wave 1주 호흡에 부적합                                            |
| MapLibre + Maptiler/Stadia OSM      | 양쪽 OS 일관, 무료, OSS 풀스택 학습 가치 ↑↑           | 한국 도로 데이터 OSM 약함 / 학습 곡선 ↑ / 1주 호흡 부담                               | 본인 UX 거부감 회피 의도와 일치는 하지만 한국 데이터 약점이 본인 일상 사진 케이스에 부적합 |
| `expo-maps` (Expo 공식)             | Expo 공식 / 단순 셋업 / Apple+Google wrapper          | Cluster 부재 / Google/Apple 강제로 동일 UX 거부감                                     | Google/Apple UX 거부감 회피 X                                                              |

## 결과 / 영향

### 구조 변경

- ADR-0009 supersede 박제 ([0009 헤더 정정](./0009-mobile-map-library-react-native-maps.md))
- **Trailog 도메인 재정의** — PROJECT_ROOT 명시: "한국 사용자 중심 + 해외는 Phase 후속"
- **학습 영역 #3 정복 관점 정정** — RN 표준 lib 베이스 정복 보류 → 한국 시장 실무 lib 정복으로 전환

### 의존성 swap

```bash
# 제거
pnpm --filter @trailog/mobile remove react-native-maps

# 추가
pnpm --filter @trailog/mobile exec expo install @mj-studio/react-native-naver-map expo-build-properties
```

(`expo-location`은 그대로 유지 — D2 위치 권한 + D6 reverseGeocodeAsync용)

### app.json 정정

- Google Maps `android.config.googleMaps` 자리 미생성 (이미 안 박았음)
- 네이버맵 plugin + expo-build-properties plugin 추가 (Naver Maven repository 주입):

```json
{
  "expo": {
    "plugins": [
      ...existing,
      [
        "@mj-studio/react-native-naver-map",
        { "client_id": "${NAVER_MAP_CLIENT_ID}" }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "extraMavenRepos": ["https://repository.map.naver.com/archive/maven"]
          }
        }
      ]
    ]
  }
}
```

### Naver Cloud Platform 발급 (본인 작업)

1. https://www.ncloud.com 가입 (본인 인증 — 휴대폰)
2. 콘솔 → AI·Application Service → **Maps** → 이용 신청
3. **Application 등록** — 서비스 환경: iOS + Android 둘 다 선택 + bundle ID `com.trailog.app`
4. **Client ID 발급** — 다이나믹 지도 / Geocoding (역지오코딩 D6용)
5. dev/prod 같은 Client ID OK (사용량 무제한 무료라 분리 의미 ↓)

### 향후 작업

- D2 — `(tabs)/map` 골격 + 위치 권한 + 기본 지도 표시 (네이버맵 컴포넌트)
- D3 — 백엔드 bbox 쿼리 API (PostGIS — 변경 없음)
- D4 — pin + popup → photo detail navigation
- D5 — Cluster (네이버맵 자체 cluster 지원 여부 검증 필요 — D5 진입 시 정확히 확인)
- D6 — 사진 상세 미니맵 + 네이버 Geocoding (Phase 2 4.6 D4d 박제 항목)
- D7 — 학습 노트 3건 (한국 지도 SDK 비교 / cluster 알고리즘 / PostGIS 공간 쿼리)

## 재검토 트리거

1. **글로벌 출시 검토 시점 (Phase 4+ 또는 마케팅 결정 시)** — 해외 사진 핀 표시 정밀도 부족이 사용자 피드백으로 올라오면 multi-provider 또는 글로벌 lib 추가 검토 (react-native-maps 또는 MapLibre 병행)
2. **`@mj-studio/react-native-naver-map` 유지보수 정체/중단 시** — 카카오 community lib 또는 MapLibre + Naver 자체 raster tile API 마이그레이션 검토
3. **Expo SDK 메이저 업그레이드 시 (SDK 57+, 58+)** — 호환성 검증 + 깨지면 alternative 능동 검토
4. **사용자 100명+ + 해외 사용자 비율 ↑ 시점** — multi-provider 정책 또는 글로벌 마이그레이션 결정

위 트리거 메모리 박제 — `mobile-map-library-revisit` (D1 종료 시점에 박제).

## 참고

- [@mj-studio/react-native-naver-map - npm](https://www.npmjs.com/package/@mj-studio/react-native-naver-map)
- [React Native Naver Map docs](https://rnnavermap.mjstudio.net/)
- [Expo Basic Setup (공식)](https://rnnavermap.mjstudio.net/docs/installation/expo)
- [GitHub mym0404/react-native-naver-map](https://github.com/mym0404/react-native-naver-map)
- [Naver Cloud Platform — Maps](https://www.ncloud.com/product/applicationService/maps)
- [expo-build-properties](https://docs.expo.dev/versions/latest/sdk/build-properties/)
