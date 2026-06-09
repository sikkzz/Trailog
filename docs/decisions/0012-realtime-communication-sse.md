# ADR-0012: 실시간 통신 — SSE (Server-Sent Events) 채택

> **상태**: Accepted
> **날짜**: 2026-06-09
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 3 Spec](../specs/phase-03-sharing.md)

---

## 맥락 (Context)

> **2026-06-09 reshape 박제**: 본 ADR 작성 시점엔 동행자 초대 + 새 사진 추가 알림이 핵심 흐름이었음. 본인 결정 — 동행자 시스템 보류 → SSE 학습 흐름 변경: **사진 처리 진행률 polling([Phase 2 4.6 박힘](../specs/phase-02-core-features.md)) → SSE 마이그레이션 + 알림 센터(사진 처리 완료 / 공유 링크 조회됨)**. SSE 채택 자체는 그대로 유효.

Phase 3 사진 공유 wave 진입 시점. 실시간 알림 필요:

- 사진 처리 진행률 (Phase 2 4.6은 polling 박혀있음 — SSE로 마이그레이션)
- 공유 링크 외부 조회됨 알림 (5.1 wave 본인 인지)
- 알림 센터 (자기 알림 누적)

통신 방식 선택:

1. **SSE (Server-Sent Events)** — HTTP 단방향 (server → client)
2. **WebSocket** — 양방향 풀듀플렉스
3. **HTTP Polling** — 주기적 GET (이미 4.6 사진 처리 polling 채택)

Trailog 알림 흐름은 **단방향** (서버 → 클라이언트). 클라이언트가 양방향 통신 필요한 시점 없음 (사용자 액션은 일반 REST API로 충분).

## 결정 (Decision)

**선택**: **SSE — NestJS `@Sse()` 데코레이터 + 모바일 `react-native-sse`**.

## 이유 / 트레이드오프

### 왜 SSE인가

- **단방향 = SSE 정확한 fit** — Trailog 알림은 server push만. 양방향 X.
- **HTTP 위에서 동작** — 별도 프로토콜 X, 기존 인프라(Fly.io HTTP/HTTPS) 재사용. NestJS Bearer 인증 그대로 활용.
- **NestJS 표준 지원** — `@Sse()` 데코레이터로 RxJS Observable 반환 (단순). WebSocket은 별도 Gateway 구성 필요.
- **자동 재연결** — EventSource 표준 명세에 lastEventId + retry 박혀있음. 모바일에서 끊김 자동 회복.
- **방화벽/프록시 친화** — WebSocket은 일부 enterprise 프록시에서 거부. SSE는 일반 HTTP.

### 얻는 것

- 단순 구현 (`@Sse()` + RxJS Subject 패턴)
- HTTP 인증 흐름 그대로 (Bearer header)
- 자동 재연결 + lastEventId 복구
- 학습 가치: HTTP/2 long-lived connection + RxJS Observable 패턴

### 포기하는 것

- 양방향 통신 — Phase 4+ 채팅/실시간 협업 시점에 WebSocket 추가 검토
- 일부 브라우저 한계 — Mobile RN context엔 영향 X (react-native-sse가 polyfill)
- 동시 연결 수 한계 — HTTP/1.1 6개 per origin. HTTP/2면 multiplexing OK. Fly.io는 HTTP/2 지원

### 학습 가치 관점

- **#4 실시간 통신** 영역 진입 (PROJECT_ROOT 2장)
- NestJS `@Sse()` + RxJS Observable + Subject pattern 정복
- 모바일 EventSource lib 통합 패턴
- WebSocket vs SSE 차이 학습 노트로 박제 (Phase 5+ WebSocket 시점에 다시 참조)

## 검토한 대안

| 대안                        | 장점                                          | 단점                                                                                       | 제외 이유                                                                           |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **A. SSE** ⭐               | 단방향 fit + HTTP + 자동 재연결 + NestJS 표준 | 단방향 한정                                                                                | (채택)                                                                              |
| B. WebSocket                | 양방향 + 풀듀플렉스 + Socket.IO ecosystem     | 과한 복잡도 (양방향 불필요) + 별도 프로토콜 + Gateway 구성 + RN socket.io-client 추가 의존 | Trailog 단방향만 필요. 과한 복잡도. WebSocket 학습은 Phase 4+ 채팅/실시간 협업 시점 |
| C. HTTP Polling             | 단순 (이미 4.6 사진 처리 polling 채택)        | latency ↑ + 서버 부담 ↑ + 알림 즉시성 ↓                                                    | 알림은 즉시성 핵심. polling은 30초~1분 latency. push 통신이 자연                    |
| D. Firebase Cloud Messaging | production-ready + 푸시까지 통합              | 외부 의존 (Google) + 학습 가치 ↓ + 인앱 SSE와 별도 흐름                                    | 학습 영역 fit X. 푸시는 Phase 4 별도 (Expo Notifications)                           |

## 결과 / 영향

### 백엔드 (`apps/server/`)

- 새 모듈 `notifications/` — NestJS `@Sse()` Controller + RxJS `Subject<MessageEvent>`
- 동행자 초대 / 새 사진 추가 시점에 `subject.next({ type, payload })` 호출
- 인증: 기존 JWT Guard 그대로 (SSE도 Bearer header)
- 한 사용자당 active SSE 연결 추적 (간단한 in-memory Map — Phase 4 Redis로 확장)

### 모바일 (`apps/mobile/`)

- 새 lib `src/lib/notifications/` — `react-native-sse` 활용 EventSource hook
- `_layout.tsx` 또는 query layer에서 글로벌 SSE 연결 mount (인증 후)
- React Query 캐시 invalidation 트리거 (예: 동행자 추가 알림 → moments query refetch)
- 알림 센터/뱃지 UI (Phase 3 5.6 폴리시)

### 인프라

- Fly.io HTTP/2 연결 유지 OK (별도 설정 X)
- 향후 ECS 이동 시 ALB가 HTTP/2 + SSE 지원 (대부분 클라우드 로드밸런서 표준)

### 추가 의존성

- 모바일: `react-native-sse` (안정 lib, MIT, RN 0.74+ 호환)
- 백엔드: 없음 (NestJS `@Sse()` + `rxjs` 이미 내장)

## 재검토 트리거

- **양방향 통신 필요** — 실시간 채팅, 협업 편집, 사용자간 직접 통신
- **동시 연결 수 한계 도달** — 1만+ 동시 연결 (Phase 5+ 운영 진입 시)
- **WebSocket 학습 시점** — Phase 4+ 학습 다양화 시점에 WebSocket 정복 (현재는 SSE 우선)
- **푸시 알림과의 분기** — 앱 닫힌 상태 알림은 별도 (Phase 4 Expo Notifications + FCM/APNS)

## 참고

- [MDN — Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [NestJS — Server-Sent Events](https://docs.nestjs.com/techniques/server-sent-events)
- [react-native-sse GitHub](https://github.com/binaryminds/react-native-sse)
- [Phase 3 Spec](../specs/phase-03-sharing.md) — 4.4 실시간 알림 AC
