# SSE vs WebSocket + 실시간 통신 패턴

> **작성일**: 2026-07-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #4 실시간 통신 (PROJECT_ROOT 2장) — 본격 진입
> **관련 문서**: [Phase 3 Spec 4.3](../specs/phase-03-sharing.md), [ADR-0012 SSE 채택](../decisions/0012-realtime-communication-sse.md)

---

## 한 줄 요약

**SSE = HTTP 위 단방향 push (server → client)**. WebSocket이 풀듀플렉스라 더 강력하지만 대부분의 알림/스트리밍 시나리오는 단방향이라 SSE가 정직한 선택. Trailog는 사진 처리 완료 / 공유 조회됨 알림에 채택. 참조 코드도 회의 이벤트 push에 SSE 활용 — 도메인 fit이면 WebSocket 오버킬.

## 우리 프로젝트에서 어디에 쓰이는가

Phase 3 5.3 wave 전체:

- **백엔드** `apps/server/src/notifications/` — NestJS `@Sse()` + RxJS `Subject`
- **모바일** `apps/mobile/src/lib/notifications/` — `react-native-sse` EventSource
- **소비 지점**:
  - `photo.processed` → `useMomentPhotos` 캐시 invalidate (Phase 2 4.6 polling 대체)
  - `share.viewed` → 알림 센터 목록 push

## 3가지 실시간 패턴 — 언제 뭐 쓸까

### 1. HTTP Polling (Trailog Phase 2 4.6 채택했다가 5.3에서 SSE로 대체)

```typescript
useQuery({
  queryFn: getMomentPhotos,
  refetchInterval: (q) => (hasPending(q.data) ? 3000 : false),
});
```

| 특징        | 값                                                                  |
| ----------- | ------------------------------------------------------------------- |
| 통신 방향   | client → server (client가 물어봄)                                   |
| 지연        | polling 간격만큼 (3초 예시)                                         |
| 서버 부담   | 상태 변화 없어도 매번 요청                                          |
| 인프라      | 완전 표준 HTTP, 캐시/CDN 활용 가능                                  |
| 구현 난이도 | ⭐ (React Query가 다 해줌)                                          |
| **언제 씀** | 상태 변화가 뜸함 + latency 관대 (예: 백그라운드 job 상태 초기 확인) |

### 2. SSE (Server-Sent Events) — Trailog Phase 3 5.3 채택

```typescript
// 백엔드
@Sse('stream')
stream(@CurrentUser() user): Observable<MessageEvent> {
  return this.notificationsService.getOrCreateChannel(user.id).asObservable()
    .pipe(finalize(() => cleanup(user.id)));
}

// 모바일
const es = new EventSource(url, { headers: { Authorization: `Bearer ${token}` } });
es.addEventListener('message', (e) => onPayload(JSON.parse(e.data)));
```

| 특징          | 값                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| 통신 방향     | **server → client** (단방향, 서버가 push)                                                                |
| 지연          | 즉시 (~ms)                                                                                               |
| 서버 부담     | 연결 유지 (HTTP long-lived) + emit 시점만 트래픽                                                         |
| 프로토콜      | **HTTP 그대로** (별도 upgrade X)                                                                         |
| 재연결        | **자동** — EventSource 표준 명세 (retry + lastEventId)                                                   |
| 방화벽        | 표준 HTTP 위 → 대부분 프록시 통과                                                                        |
| 브라우저 지원 | 모던 브라우저 native + RN은 `react-native-sse` polyfill                                                  |
| 인증          | Bearer header 그대로 활용 (RN은 헤더 박기 가능, 웹은 EventSource 표준이 헤더 미지원이라 커스텀 lib 필요) |
| **언제 씀**   | server → client push 단방향 + 알림/스트리밍 + HTTP 인프라 재사용 우선                                    |

### 3. WebSocket

```typescript
// NestJS Gateway (별도)
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('chat.send')
  handleChat(client: Socket, payload: ChatPayload): void { ... }
}
```

| 특징          | 값                                                           |
| ------------- | ------------------------------------------------------------ |
| 통신 방향     | **양방향** (풀듀플렉스)                                      |
| 지연          | 즉시 (~ms)                                                   |
| 서버 부담     | 연결 유지 + emit 시점만                                      |
| 프로토콜      | **별도 프로토콜** (HTTP upgrade → ws/wss)                    |
| 재연결        | 라이브러리 몫 (socket.io 자동, native ws는 수동)             |
| 방화벽        | 일부 엔터프라이즈 프록시가 upgrade 차단 → **문제될 수 있음** |
| 브라우저 지원 | 모던 브라우저 native                                         |
| 인증          | HTTP upgrade 시 인증만 → 이후 세션 유지 (별도 프로토콜)      |
| **언제 씀**   | 양방향 필요 (채팅, 실시간 협업, presence, 게임)              |

## Trailog 결정 흐름 (ADR-0012)

```
"실시간 알림 필요"
    │
    ├─ 양방향? ─── No ─── SSE ✅
    │                     │
    │                     ├─ 사진 처리 완료 (backend push)
    │                     └─ 공유 조회됨 (backend push)
    │
    └─ Yes ─── WebSocket
              (Trailog 미채택 — 도메인 fit X)
```

**결정 근거**:

- Trailog 사용자 액션은 **일반 REST API로 충분** (Moment 생성, 사진 업로드 등)
- 실시간 필요는 **서버가 알려주는 이벤트만** (처리 완료, 조회됨)
- → 단방향 SSE가 도메인 fit
- WebSocket은 채팅/협업 도메인 (Phase 4+ 확장 시점)에 재검토

## 참조 코드(blaybus-service) 패턴 비교

같은 SSE 채택이지만 세부는 도메인 차이에서 자연 갈림:

| 항목               | 참조 (blaybus-service)                                    | Trailog (Phase 3 5.3)                  |
| ------------------ | --------------------------------------------------------- | -------------------------------------- |
| **구독 단위**      | `projectId` — 프로젝트 멤버 fan-out                       | `userId` — 개인 알림만                 |
| **자료구조**       | `Map<projectId, Subject>` + subscriberCount (다중 구독자) | `Map<userId, Subject>` (1 user 1 채널) |
| **Heartbeat**      | 15초 (`interval(15_000)` merge)                           | X (Phase 4 도입)                       |
| **Active Sync**    | 새 구독 시 현재 활성 회의 즉시 push (Redis 조회)          | X (알림은 stateless)                   |
| **Redis Presence** | `SET NX EX` atomic + TTL 90s 좀비 방지                    | X (in-memory)                          |
| **인증 가드**      | 별도 `SseAuthGuard` (쿠키 + CSRF 우회)                    | 일반 `JwtAuthGuard` (Bearer로 충분)    |
| **cleanup**        | RxJS `finalize()`                                         | RxJS `finalize()` (참조 패턴 채택)     |

**왜 이렇게 다름**:

- **fan-out 유무**: 참조는 협업 도메인(회의/녹음 → 팀 공유). Trailog는 Day One 패턴(본인 알림) → 개인 채널로 충분
- **Heartbeat/Redis/APM 부재**: Trailog Phase 3은 학습 진입용 최소 구성. Phase 4 ECS 진입 시점에 도입 트리거(메모리 `sse-phase4-enhancements-revisit`)
- **인증 가드 차이**: 참조는 쿠키+CSRF 웹 인증이라 EventSource 헤더 제약과 충돌 → 별도 가드. Trailog는 모바일 Bearer라 일반 가드로 충분

## 실제 흐름 다이어그램

### 사진 업로드 → SSE push

```
모바일                     백엔드 API               BullMQ Worker          모바일 SSE
  │                          │                         │                      │
  │  POST /photos/upload-url │                         │                      │
  ├─────────────────────────>│                         │                      │
  │  presigned URL 발급      │                         │                      │
  │<─────────────────────────┤                         │                      │
  │                          │                         │                      │
  │  PUT R2 (직접)           │                         │                      │
  ├──────────>│              │                         │                      │
  │                          │                         │                      │
  │  POST /photos/confirm    │                         │                      │
  ├─────────────────────────>│                         │                      │
  │  Photo row 생성          │  job enqueue           │                      │
  │                          ├─────────────────────────>│                      │
  │<─────────────────────────┤                         │                      │
  │                          │                         │ sharp 3-size WebP    │
  │                          │                         │ + EXIF 추출          │
  │                          │                         │ + strippedKeys 생성  │
  │                          │                         │                      │
  │                          │  publish(userId,       │                      │
  │                          │  photo.processed done) │                      │
  │                          │<─────────────────────────┤                      │
  │                          │                         │                      │
  │  SSE data: {...}         │                         │                      │
  │<────────────────────────────────────────────────────────────────────────┤
  │                          │                         │                      │
  │  queryClient.invalidateQueries(photos.list)         │                      │
  │  addNotification(payload)                           │                      │
```

### 공유 조회됨 → owner 알림

```
외부 사용자              백엔드 API                       Owner (SSE 연결)
  │                        │                                 │
  │ GET /shares/public/:token │                              │
  ├──────────────────────>│                                  │
  │  findPublicByToken()  │                                  │
  │  emitViewedIfNeeded() │                                  │
  │  (5분 throttle 통과)  │                                  │
  │                       │  publish(ownerId, share.viewed) │
  │                       ├────────────────────────────────>│
  │  share 응답 (사진 등) │                                  │
  │<──────────────────────┤                                  │
  │                       │                                  │
  │                       │        SSE data: {...}          │
  │                       ├────────────────────────────────>│
  │                       │                                  │
  │                       │  뱃지 +1, 알림 센터에 push       │
```

## 핵심 개념

### 1. RxJS Subject — pub/sub 코어

```typescript
private readonly channels = new Map<string, Subject<MessageEvent>>();

publish(userId: string, payload) {
  this.channels.get(userId)?.next({ data: payload });
}

// Controller에서 asObservable() → NestJS @Sse가 HTTP text/event-stream으로 변환
```

- **Subject** = Observable + Observer 동시. `next()`로 값 밀어넣기 + 구독자에게 전달
- **BehaviorSubject / ReplaySubject** 대안: 최신값 저장(Behavior) / 히스토리 저장(Replay). 알림은 stateless라 일반 Subject
- 회사 패턴도 동일 자료구조 — `Map<key, Subject>` + subscribe count로 마지막 구독자 나갈 때 cleanup

### 2. NestJS @Sse() 데코레이터

```typescript
@Sse('stream')
stream(@CurrentUser() user): Observable<MessageEvent> {
  return channel.asObservable().pipe(finalize(() => cleanup()));
}
```

- 메서드 반환 = `Observable<MessageEvent>`. NestJS가 자동으로:
  - `Content-Type: text/event-stream` 헤더
  - each emit → `data: <json>\n\n` 형식
  - HTTP long-lived connection 유지
- Guard(`@UseGuards`) + Decorator(`@CurrentUser`) 그대로 활용 — 일반 REST와 동일

### 3. RxJS `finalize()` vs `req.on('close')`

```typescript
// ❌ 참고 파일 (이전 D1 초기)
req.on('close', () => cleanup());

// ✅ 정정 후
channel.asObservable().pipe(finalize(() => cleanup()));
```

- `finalize()` = Observable 완료/에러/unsubscribe **모두** 캐치
- `req.on('close')`는 HTTP 연결 자체만 감지 — RxJS pipeline 예외로 인한 unsubscribe는 놓침
- NestJS `@Sse` + RxJS 표준 패턴은 finalize가 정직

### 4. react-native-sse (Bearer 헤더 지원)

웹 표준 `EventSource`는 **커스텀 헤더 미지원** (스펙 제약). RN은 polyfill lib이 헤더 박기 지원:

```typescript
const es = new EventSource(url, {
  headers: { Authorization: `Bearer ${token}` },
});
```

- 모바일 Bearer 인증 그대로 활용 가능 (RN은 쿠키 X → cookie 인증도 X)
- 웹에서 SSE + 인증하려면 별도 lib(예: `@microsoft/fetch-event-source`) 활용해야 함 — 참조 코드가 SseAuthGuard 별도 박은 이유

### 5. 알림 throttle (5분)

```typescript
private readonly lastViewedEmit = new Map<string, number>();
private emitViewedIfNeeded(share: Share): void {
  const now = Date.now();
  const last = this.lastViewedEmit.get(share.id);
  if (last && now - last < SHARE_VIEWED_THROTTLE_MS) return;
  this.lastViewedEmit.set(share.id, now);
  this.notificationsService.publish(share.ownerId, { ... });
}
```

- 같은 share 반복 조회(새로고침/여러 명 접속) → owner 스팸 방지
- Trailog는 in-memory Map (단일 인스턴스). Phase 4 ECS 다중 인스턴스 시점에 Redis `SETEX`로 이전

### 6. 폴링 대체 자연 흐름

```typescript
// Phase 2 4.6 (제거됨)
refetchInterval: (q) => (hasPending(q.data) ? 3000 : false);

// Phase 3 5.3 (SSE 도입 후)
// SSE 훅이 photo.processed 받으면 invalidate → 즉시 refetch
queryClient.invalidateQueries({ queryKey: photosKeys.list(momentId) });
```

- 폴링 3초 latency → **즉시 (~ms)**
- 서버 부담 ↓ (매 3초 쿼리 X → 실제 완료 시점 1회만)
- 학습 관점: React Query + SSE 조합의 정직한 패턴 — SSE는 **invalidate 트리거만**, 데이터 fetch는 React Query 표준 흐름 유지

## 함정 (10종)

### 1. Fly.io/ALB idle timeout으로 자동 종료

프록시가 60초 무통신 시 close 박음. 알림이 뜸한 시점에 연결 끊김 → EventSource 자동 재연결 반복 → 서버 부담 ↑.

**해결**: Heartbeat 15초 간격 emit (참조 패턴). Phase 4에 도입 (`sse-phase4-enhancements-revisit`).

### 2. 다중 인스턴스 fan-out 안 됨

ECS scale=2 이상이면 인스턴스A가 publish한 알림이 인스턴스B에 연결된 유저에게 안 감. `Map`은 process local.

**해결**: Redis Pub/Sub. Phase 4에 도입.

### 3. EventSource 표준 명세 — 웹은 헤더 미지원

브라우저 EventSource는 `Authorization: Bearer` 헤더 박기 불가. 쿠키 인증 or query string(비추) or 별도 lib.

**Trailog 회피**: 모바일 only → `react-native-sse`가 헤더 지원. 웹 사이드(`apps/web`)는 현재 SSE 사용 X.

### 4. RxJS finalize 중복 호출

`Subject.complete()` + 새 구독 사이클 안 열리면 finalize 즉시 재실행 → cleanup 여러 번. 참조 코드는 subscriberCount로 방어.

**Trailog 현재**: 1 user 1 채널이라 문제 X. 다중 구독 도입 시 참조 패턴 채택.

### 5. `req.on('close')` — RxJS unsubscribe 놓침

Observable pipeline 안에서 에러 throw 시 HTTP는 살아있지만 stream은 죽을 수 있음. `req.on('close')`는 못 잡음.

**해결**: `finalize()` (D1 정정 사유).

### 6. 알림 payload 스키마 불일치 fail-hard

백엔드가 payload 확장 시 모바일 오래된 앱이 못 파싱 → crash.

**Trailog 회피**: Zod `safeParse` + silent skip. 신규 type은 클라이언트가 무시.

```typescript
const parsed = NotificationPayloadSchema.safeParse(raw);
if (!parsed.success) return; // fail-soft
```

### 7. React Query 캐시 무한 loop

SSE로 payload 도착 → invalidate → refetch → refetch 결과가 또 SSE 조건 트리거 → 무한. 주의해야 함.

**Trailog 안전**: `photo.processed`는 서버 이벤트라 refetch 자체가 트리거 재발생 X. 단 SSE에서 데이터 mutation을 만들면 위험.

### 8. 앱 백그라운드 시 연결 유지 여부

RN 앱 백그라운드 진입 시 iOS는 소켓 종료, Android는 유지 (기기별 배터리 정책). 재진입 시 재연결 필요.

**해결**: 앱 활성 상태 훅(`AppState`)으로 재연결 트리거. Trailog 현재 미구현 — Phase 4 UX 폴리시 시점.

### 9. 로그아웃 후 SSE 연결 끊기 누락

authStorage.clear() 후 SSE stream 그대로면 서버가 이전 유저 토큰으로 계속 push. 메모리 누수 + 보안.

**Trailog 현재**: `useNotificationsStream(accessToken)` 훅이 token null이면 스트림 안 만듦. 로그아웃 → token null → 자동 close. OK.

### 10. throttle을 in-memory로 하면 재시작 시 무효

서버 재시작 시 `Map` 초기화 → 방금 발행한 알림 5분 안에 재발행 가능.

**Trailog 현재**: 재시작 시 소량 스팸 허용 (개발 편의). Phase 4 Redis 이전 시 자연 해결.

## Phase 후속 정복 항목

`sse-phase4-enhancements-revisit` 메모리에 박제:

1. **Heartbeat** (15초 간격) — idle timeout 대응
2. **Redis Pub/Sub Presence** — 다중 인스턴스 fan-out
3. **APM 메트릭** (연결 수, 발행 수) — 관측 가시성
4. **알림 영속화** (DB 저장 + 미수신 백필) — 오프라인 알림
5. **WebSocket 도입 검토** — 채팅/협업 도메인 확장 시점 (Phase 4+ 학습 영역 다양화)
6. **앱 백그라운드 재연결** — `AppState` 훅 통합

## 참고 링크

- [MDN — Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [NestJS — Server-Sent Events](https://docs.nestjs.com/techniques/server-sent-events)
- [react-native-sse](https://github.com/binaryminds/react-native-sse)
- [RxJS Subject](https://rxjs.dev/guide/subject)
- [ADR-0012 SSE 채택](../decisions/0012-realtime-communication-sse.md)
- 관련 메모리: SSE Phase 4 도입 항목 추후 인지 + 실시간 통신 패턴 비교

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
