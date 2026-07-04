# ADR-0017: 1차 마무리 시점 결정 — Phase 3 종료

> **상태**: Accepted
> **날짜**: 2026-07-04
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [PROJECT_ROOT 9장 성공 기준](../PROJECT_ROOT.md#9-성공-기준), [Phase 3 Spec](../specs/phase-03-sharing.md), [Phase 4 Spec (보류)](../specs/phase-04-operations-and-aws-migration.md), [Trip wave Spec (보류)](../specs/phase-03-ext-trip-timeline.md)

---

## 맥락 (Context)

2026-05-21 시작 → 2026-07-04 = **약 6.5주** 진행 시점. Phase 3 4개 wave 완주(공유 링크 / EXIF strip / SSE / 학습 노트 마감) 직후 "1차 마무리 시점"을 언제 잡을지 결정 필요.

### 현재 자산 정리

- **Phase 1**: 인프라 셋업 + Fly.io 배포 + GitHub Actions + Notion sync
- **Phase 2**: 인증 + DB(TypeORM+PostGIS) + 사진 파이프라인(R2+sharp+BullMQ+EXIF) + 지도(NaverMap+클러스터) + 모바일 첫 화면 + NativeWind
- **Phase 3**: 공유 링크(nanoid+Next 16 사이드) + EXIF strip(piexifjs+Lazy 캐싱) + SSE(RxJS+react-native-sse+알림 센터) + 학습 노트 4건
- **누적**: ADR 16건 + 학습 노트 34건 + 3앱 모노레포(mobile/server/web) + 실 디바이스 검증(iOS Personal Team + Android EAS dev build)

### 학습 영역 진행 (PROJECT_ROOT 2장)

- ✅ #1 인프라/DevOps (Phase 1 완주)
- ✅ #2 이미지/미디어 (Phase 2 4.3~4.5 + Phase 3 5.2)
- ✅ #3 지도/시각화 (Phase 2 4.7 — 표시/클러스터/PostGIS bbox까지. 심화 폴리라인/타임라인은 보류)
- ✅ #4 실시간 통신 (Phase 3 5.3 SSE)
- ⚠️ #5 성능 최적화/캐싱 (React Query만, Redis 캐싱 X)
- ⚠️ #6 모바일 네이티브 + 앱 배포 (dev build만, 스토어 X)

### 성공 기준 도달 여부 (PROJECT_ROOT 9장)

- ✅ **최소 성공(Must)** 이미 달성:
  - 실 디바이스 실사용 (iPhone + Galaxy)
  - 학습 영역 4개 이상 실전 경험
  - GitHub 정리된 코드 + README
- ⚠️ **중간 성공(Should)** 부분 달성:
  - 학습 영역 6개 모두 경험: 4개 완주 + 2개 부분
  - 지인 베타 5명 이상 사용: X (스토어 배포 X)
  - 기술 블로그 3편 이상: X (별도 repo 흐름)

## 결정 (Decision)

**"Phase 3 4개 wave 완주 + 문서/이력 정리 완료 시점 = 1차 마무리"** 로 확정 (2026-07-04).

**미포함 결정 (2차 확장 후보로 박제)**:

- Phase 4 (운영 강화 + AWS ECS 마이그레이션) 전체
- Phase 3 확장 Trip wave (polyline + 타임라인)
- 스토어 배포 (Apple Developer + Google Play)
- 학습 영역 #5(캐싱 심화) / #6(스토어 배포) 완주

## 이유 / 트레이드오프

### 왜 지금이 정직한 마무리 시점

1. **최소 성공 이미 달성** — PROJECT_ROOT 9장 Must 조건 도달. 사이드로서 안전 지대 확보.
2. **학습 영역 4개 완주** — 인프라/이미지/지도/실시간 = 사이드 학습 명분 충분. 나머지 2개는 실 사용자/실무 트리거 있어야 정직 학습 가능.
3. **정직한 사이드 호흡** — 시작 6.5주 시점. PROJECT_ROOT 8장 "포기하지 말 것의 함정" 회피 관점에서 명확한 종료 시점 필요.
4. **자산 정리 관점** — ADR 16 + 학습 노트 34 = 이미 정직한 학습 아카이브. 추가 개발보다 정리/공유가 자연.

### 왜 Phase 4 (스토어 + AWS) 스킵

1. **스토어 배포 실비 트레이드오프** — Apple Developer $99/년 + Google Play $25 일회성. 실 사용자 확보 계획 없이 부담 정당화 X. 본인 명시 "RN 개발 해봤다 정도의 경험만".
2. **AWS 오버킬** — 트래픽 없이 관측 metric / 비용 최적화 학습 실감 낮음. 실 사용자 100명+ 시점에 자연 트리거.
3. **학습 영역 #1 이미 1차 정복** — Phase 1 Fly.io+Docker+CI/CD로 인프라 실무 감 확보. AWS 실무 스택 정복은 별도 프로젝트급 스토리로 미룸.
4. **호흡 관리** — Phase 4 4~6주 추가하면 총 12주+. 사이드 정직 스코프 초과 위험.

### 왜 Trip wave 스킵

1. **필수 X** — Moment/Photo 단독으로 사용 흐름 완성. Trip은 상위 편의 개념이라 없어도 core 미완 X.
2. **개발 wave 확장 최소화** — 1차 마무리 결정 시점에 개발 wave 더 안 늘리는 게 정직.
3. **spec은 보존** — 미래 재활성 시 참고 자산으로 phase-03-ext-trip-timeline.md 유지.

### 얻는 것

- **명확한 1차 완성** — 사이드 프로젝트 흐지부지 안티패턴 회피
- **학습 자산 정리 시간** — 개발 대신 문서/블로그/포트폴리오 활용
- **본인 호흡 회복** — 6.5주 몰입 후 정직한 브레이크
- **2차 확장 옵션 열어둠** — 실 사용자 확보/실무 이전 등 트리거 발생 시 재개 가능

### 포기하는 것

- **학습 영역 #5, #6 완주 스토리** — PROJECT_ROOT 9장 중간 성공 조건 미달
- **실 사용자 도달 검증** — 스토어 배포 없어 dev build 시연 수준
- **AWS 실무 스택 정복** — 실무 이전 or 별도 프로젝트에서 이어감

## 2차 확장 후보 (재활성 트리거 명시)

우선순위 순:

### 후보 1 — Trip + polyline + 타임라인 (1.5~2주)

- **재활성 트리거**: 사용자 피드백 여행 단위 관리 필요성 노출 / 시각화 wow factor 요구 / 사이드 2차 wave 착수 결정
- **spec**: [Trip wave Spec](../specs/phase-03-ext-trip-timeline.md) (보류 상태 보존)
- **학습 영역**: #3 지도/시각화 100% 정복

### 후보 2 — 스토어 배포 (2주)

- **재활성 트리거**: 실 사용자 확보 계획 확정 / 지인 베타 5명+ 확보 의도 / Apple Developer 실비 정당화
- **범위**: EAS Submit + TestFlight + Google Play 내부 트랙
- **학습 영역**: #6 완주

### 후보 3 — 관측 인프라 최소 (Sentry) (3~4일)

- **재활성 트리거**: 스토어 배포와 세트로 진행 (에러 잡기 실효 확보)
- **범위**: Sentry 3앱 통합 + 비용 알람 + 구조화 로깅

### 후보 4 — AWS ECS 마이그레이션 (4~6주)

- **재활성 트리거**: 실 사용자 100명+ / 회사 이관/실무 이전 / 2차 프로젝트급 스토리 결정
- **spec**: [Phase 4 Spec](../specs/phase-04-operations-and-aws-migration.md) (보류 상태 보존)
- **학습 영역**: #1 2차 정복 + #5 캐싱 심화

### 후보 5 — 사진 편집 / 검색 / 태그 / 즐겨찾기

- **재활성 트리거**: 사용자 피드백 우선순위 상승 / 사이드 계속 흐름
- **범위**: expo-image-manipulator / Postgres full-text search / tag entity + N:M

## 검토한 대안

| 대안                                | 소요       | 장점                             | 단점                              | 제외 이유                                 |
| ----------------------------------- | ---------- | -------------------------------- | --------------------------------- | ----------------------------------------- |
| **A. 지금 마무리** ⭐               | 반나절~1일 | 정직한 브레이크 + 자산 정리 집중 | 학습 영역 #5, #6 미완 감          | (선택안)                                  |
| B. Trip wave + 블로그 (3~4주)       | 3~4주      | 지도 100% 정복 + 시각화 wow      | 개발 늘어질 위험 + 필수 X         | 개발 wave 확장 최소화 원칙                |
| C. Phase 4 6.1 관측만 (3~4일)       | 3~4일      | 운영 도구 익힘                   | 실 사용자 X면 관측 대상 본인 폰뿐 | 실효 낮음 + 스토어 배포와 세트가 자연     |
| D. Phase 4 스토어 배포 완주 (2~3주) | 2~3주      | 실 사용자 도달 + #6 완주         | 실비 부담 + 사용자 확보 계획 X    | 본인 명시 "RN 경험 정도" — 트레이드오프 X |
| E. Phase 4 AWS까지 (4~6주)          | 4~6주      | 실무 표준 완주                   | 트래픽 없어 오버킬 + 비용 폭탄    | 실 사용자 시점에 자연                     |

## 결과 / 영향

### PROJECT_ROOT.md

- 9장 성공 기준 도달 여부 정직 명시 (Must ✅ / Should 부분 달성)
- 변경 이력에 "1차 마무리 완료" 이력 추가
- 6장 로드맵 각주에 "1차 마무리 스코프 + 2차 확장 후보 5개" 명시

### README.md

- 상단 "🎉 1차 마무리 완료 (2026-07-04)" 배지 추가
- 진행 상황 섹션 Phase 1~3 완료 + Phase 4 보류 명시
- 2차 확장 후보 개괄

### spec 파일 처리

- `phase-03-sharing.md` — ✅ Completed (Phase 3 종료 시점 이미 처리)
- `phase-03-ext-trip-timeline.md` — 🅿️ Deferred (보류 상태 명시 + 재활성 트리거 박제)
- `phase-04-operations-and-aws-migration.md` — 🅿️ Deferred (보류 상태 명시 + 재활성 트리거 박제)

### 후속 흐름

- **블로그**: 본인 별도 repo(기술 블로그 자동화)에서 자연 페이스로 이어감
- **2차 확장**: 트리거 조건 발생 시 이 ADR + 보류 spec 재활성
- **본인 사이드 호흡**: 정직한 브레이크 → 다른 학습/휴식/2차 프로젝트 자유

## 참고

- [PROJECT_ROOT 8장 안티 패턴](../PROJECT_ROOT.md#8-안티-패턴--하지-말아야-할-것) — "포기하지 말 것의 함정" 회피
- [PROJECT_ROOT 9장 성공 기준](../PROJECT_ROOT.md#9-성공-기준)
- [Phase 3 Spec Completed](../specs/phase-03-sharing.md)
- [Trip wave Spec Deferred](../specs/phase-03-ext-trip-timeline.md)
- [Phase 4 Spec Deferred](../specs/phase-04-operations-and-aws-migration.md)
