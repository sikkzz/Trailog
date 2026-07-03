# nanoid와 공유 토큰 설계

> **작성일**: 2026-07-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #2 이미지/미디어 (프라이버시 인접) + 인프라 (URL 설계)
> **관련 문서**: [ADR-0014 공유 토큰 nanoid 채택](../decisions/0014-share-link-token-uuid.md), [Phase 3 Spec 4.1](../specs/phase-03-sharing.md)

---

## 한 줄 요약

**nanoid = URL-safe + 짧음 + 충돌 안전한 랜덤 ID 생성기**. UUID v4는 36자에 하이픈 박혀 URL에 흉함, base62 자체 구현은 균등 분포 실수 위험. nanoid 21자는 UUID v4와 동등한 충돌 저항(2^126) 유지하면서 URL에 그대로 박기 좋아 공유 링크 표준. Trailog Phase 3 공유 링크 토큰에 채택.

## 우리 프로젝트에서 어디에 쓰이는가

- **Phase 3 5.1** — 공유 링크 토큰 (`trailog.app/s/{nanoid}` 형태)
- 백엔드 `apps/server/src/shares/shares.service.ts` — `nanoid(21)` 생성 + DB `share.token` unique 저장

향후 후보:

- 초대 코드 (동행자 시스템 재활성 시)
- API rate limit / dedupe key
- 사용자 friendly ID (짧은 URL 요구되는 곳 어디든)

## 배경 — 왜 UUID로는 부족한가

### UUID v4 (표준 랜덤 ID)

```
550e8400-e29b-41d4-a716-446655440000
└── 36자 (하이픈 4개 포함), URL에 그대로 박기 흉함
```

**장점**:

- RFC 4122 표준 — 어디서든 인식
- 라이브러리 어디에나 있음 (Node built-in `crypto.randomUUID()`)
- 128비트 무작위성 — 충돌 사실상 X (`2^122` 유효 비트)

**공유 링크 관점 단점**:

- **길다** — URL에 박으면 `trailog.app/s/550e8400-e29b-41d4-a716-446655440000`
- **하이픈** — 복사/공유 시 줄바꿈으로 잘릴 위험 (특히 문자 앱)
- **16진수만** — 정보 밀도 낮음 (128비트를 36자로 표현)

### base62 자체 구현 유혹

```javascript
// 나쁜 예 — 균등 분포 X
function shortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
```

**함정**:

- `Math.random()` — 예측 가능 (암호학적 안전 X)
- 짧은 길이(8자) → 충돌 확률 급상승
- 균등 분포 실수 (`% chars.length` 편향)
- 재사용 검사(collision retry) 안 박으면 실서비스에서 사고

### nanoid (2017년 등장)

```javascript
import { nanoid } from 'nanoid';
nanoid(21);
// 'V1StGXR8_Z5jdHi6B-myT'
// └── 21자, URL-safe (A-Za-z0-9_-), 하이픈 없음(_/-만 특수)
```

**장점 (UUID 대비)**:

- **짧다** — 21자 (UUID 36자 대비 42% 감소)
- **URL-safe** — `A-Z / a-z / 0-9 / _ / - ` 만 활용. URL 인코딩 X
- **충돌 저항 동등** — 64진법 21자 = 64^21 = **2^126** (UUID v4의 2^122보다 오히려 강함)
- **암호학적 안전** — Node `crypto.randomFillSync` 활용
- **의존성 작음** — 118 bytes (minified)

## 충돌 확률 정직 분석

공유 링크는 **DB unique constraint** 박아둬도 collision retry 비용이 문제. 다음 표는 birthday paradox 관점:

| ID 방식                   | 길이 | 심볼 수 | 유효 비트 | 1억 개 발행 시 충돌 확률       |
| ------------------------- | ---- | ------- | --------- | ------------------------------ |
| Custom base62 8자         | 8    | 62      | ~47.6     | **1% 넘음** (실서비스 사고)    |
| nanoid 10자 (default)     | 10   | 64      | 60        | 1억당 ~4.3%                    |
| **nanoid 21자**           | 21   | 64      | **126**   | **10억 년 발행해도 무시 가능** |
| UUID v4                   | 36   | 16      | 122       | 10억 년 발행해도 무시 가능     |
| **nanoid 21자 (default)** | 21   | 64      | 126       | Trailog 채택                   |

**참고 링크**: [nanoid Collision Calculator](https://zelark.github.io/nano-id-cc/)

**Trailog 관점 — 왜 21자로 충분**:

- 예상 발행량: 사용자 1만 명 × 인당 100 링크 = 100만 개
- 1만 배 부풀려도 100억 개 — nanoid 21자로 충분히 안전
- UUID 대비 15자 절약 = URL 훨씬 짧음

## URL 설계 관점 — 왜 짧아야 하나

Trailog 공유 URL 비교:

```
UUID:    trailog.app/s/550e8400-e29b-41d4-a716-446655440000  (52자)
nanoid:  trailog.app/s/V1StGXR8_Z5jdHi6B-myT                (37자)
```

**짧을수록 좋은 이유**:

1. **문자 메시지** — SMS 160자 제한, 링크 짧을수록 여유
2. **QR 코드** — 짧을수록 오류 정정 여유 ↑ + 스캔 빠름
3. **음성 (Siri/Alexa)** — 나중에 음성 공유 UX 상상 시 짧은 게 유리
4. **입력 오류** — 사용자가 손으로 입력해야 할 시 (극단 케이스) 짧을수록 오류 ↓
5. **로그 가독성** — 서버 로그에서 URL 잘림 방지

## 구현 패턴 (Trailog)

### 백엔드 — 생성 + unique 재시도

```typescript
// apps/server/src/shares/shares.service.ts
const TOKEN_LENGTH = 21;

private async generateUniqueToken(): Promise<string> {
  // 충돌 확률 사실상 0이지만 방어적으로 재시도 loop
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = nanoid(TOKEN_LENGTH);
    const existing = await this.shareRepo.findOne({ where: { token } });
    if (!existing) return token;
  }
  throw new ConflictException('공유 토큰 생성 실패');
}
```

**왜 재시도 loop**:

- DB unique constraint 걸어놔도 write attempt 자체가 비용
- 5번 안에 안 나오면 뭔가 잘못됨 → fail-fast

### 백엔드 — DB schema

```typescript
@Entity({ name: 'shares' })
export class Share {
  @Column({ type: 'varchar', length: 32, unique: true })
  token!: string; // nanoid 21자 + 여유 11자 (future custom length)

  // ... 만료 / 비밀번호 / 정책 등
}
```

**설계 결정**:

- `varchar(32)` — nanoid 21자 + 여유 (future length 조정 시)
- `unique` index — 조회 시 O(log n) + collision 방지
- default value X — service가 명시적으로 발행

### 프론트/모바일 — 짧은 URL 조립

```typescript
// 백엔드가 완성된 URL 반환 (BACKEND_PUBLIC_URL 활용)
const shareUrl = `${BACKEND_PUBLIC_URL}/s/${token}`;
```

**왜 백엔드에서 조립**:

- URL prefix 변경 시 클라이언트 재배포 없이 대응 (dev/prod 분기 자연)
- 향후 커스텀 도메인(`trailog.app`) 이전 시 백엔드만 변경

## nanoid vs 다른 대안

### short-uuid

```javascript
import short from 'short-uuid';
short.generate(); // 'mhvXdrZT4jP5T8vBxuvm75'
```

- UUID v4를 base57로 변환 (22자)
- 근본은 UUID라 정보량 동등, 그냥 인코딩 다름
- **단점**: 라이브러리 크기 ↑, nanoid 대비 이점 X

### hashids

```javascript
import Hashids from 'hashids';
const hashids = new Hashids('salt');
hashids.encode(12345); // 'NkK9'
```

- 정수 → 짧은 문자열 인코딩 (역변환 가능)
- **단점**: 순차 ID 노출 (URL만 보면 순서 알아냄) — enumeration 공격 위험
- 공유 링크에는 부적합. 내부 debug URL엔 OK

### crypto.randomBytes + base64url

```javascript
import { randomBytes } from 'crypto';
const token = randomBytes(16).toString('base64url'); // 22자 URL-safe
```

- Node built-in만으로 가능
- **단점**: base64url 처리 직접, 커스텀 알파벳 조정 어려움
- nanoid는 이 위 얇은 wrapper — 편의 이점만

## 함정 (10종)

### 1. `crypto.randomUUID()` 오해 — 짧다고 착각

Node 15+ 내장된 `crypto.randomUUID()`는 여전히 UUID v4 (36자). "그냥 짧게 잘라 쓰면?" — 무작위성 손실 + 충돌 확률 급증. **자르지 마라**.

### 2. `Math.random()` 오해 — 암호학적 안전 X

`Math.random()` 기반 커스텀 ID는 예측 가능. 세션 후반 값 알면 이전 값 추측. 공유 링크에 절대 X. nanoid는 `crypto.randomFillSync` 활용.

### 3. 너무 짧게 채택 — 재시도 지옥

`nanoid(6)` 처럼 짧게 채택하면 1만 개만 발행해도 충돌 발생. 재시도 loop 무한. **21자 default 유지**가 정직.

### 4. 파일명으로 재사용 시 대소문자 이슈

nanoid는 대소문자 구분 (`A` != `a`). 파일 시스템 대소문자 무시(Windows/macOS default) 환경에서 파일명으로 쓰면 충돌. **URL 전용으로 활용**.

### 5. 커스텀 알파벳 → 충돌 확률 재계산

```javascript
import { customAlphabet } from 'nanoid';
const numericId = customAlphabet('0123456789', 10);
numericId(); // '4681746952'
```

- 10진법 10자 = 10^10 = 100억 — 문자 알파벳 대비 정보량 훨씬 낮음
- 커스텀 알파벳 쓰면 충돌 확률 다시 계산 필요

### 6. `nanoid-esm` vs `nanoid` 혼동

```
// package.json
"nanoid": "^5.0.0" — ESM only (Node 14+)
"nanoid-esm": ...    — 별개 lib, 혼동 마라
```

**Trailog**: NestJS CommonJS 환경 → nanoid v3 (`"nanoid": "^3.3.7"`) 활용 (v5는 ESM only)

### 7. Sync vs Async — 최근엔 sync 표준

```javascript
// v3, v5 — sync가 표준
import { nanoid } from 'nanoid';
const id = nanoid();

// nanoid/async — Node 미지원 크립토 환경 대비 lib (드묾)
import { nanoid } from 'nanoid/async';
const id = await nanoid();
```

일반 Node/Deno 환경에선 sync 활용. Async는 특수 환경(예: `crypto.getRandomValues` polyfill 필요)에서만.

### 8. DB unique constraint 없으면 사고

nanoid 21자로 충돌 확률 0에 가깝지만 DB 레벨 unique 없으면 어쨌든 우발 발생 가능. **service layer 재시도 + DB unique 둘 다 박아야 정직**.

### 9. 토큰이 곧 인증인 걸 잊음

nanoid 토큰이 **무작위 = 예측 불가** = 그 자체가 인증. **HTTPS 필수** (평문 노출 시 그대로 도용). URL에서 노출 지점 (referer header, browser history) 인지.

### 10. 로그에 토큰 그대로 박기

로그에 `POST /shares/public/V1StGXR8_Z5jdHi6B-myT/download/...` 박히면 로그 노출 = 토큰 노출. **토큰 자체는 인증**이므로 로그 partial masking 필요 (예: `V1StGXR...`).

Trailog 현재 미구현 — Phase 4 운영 진입 시 로깅 layer 도입 시점에 처리.

## Trailog 결정 흐름 (ADR-0014)

1. **UUID v4** — 길고 URL 흉함 → 채택 X
2. **base62 자체 구현** — 충돌 위험 + 재구현 부담 → 채택 X
3. **short-uuid** — nanoid 대비 이점 X → 채택 X
4. **hashids** — enumeration 공격 위험 (순차 ID 노출) → 채택 X
5. **✅ nanoid 21자** — URL-safe + 짧음 + 충돌 안전 + 표준 채택

**ADR-0014 확정 사유**:

- 학습 관점: 토큰 설계 자체가 학습 자산 (URL/보안 인접)
- 실무 관점: URL 짧을수록 UX ↑, DB unique 재시도 loop 0에 수렴
- 미래 확장: 초대 코드, dedupe key 등에도 재사용 가능

## Phase 후속 정복 항목

- **토큰 rotation** — 공유 링크 유출 시 즉시 회전 UX (현재는 취소만 지원)
- **커스텀 alias** — 사용자 지정 짧은 이름 (`trailog.app/s/my-tokyo-trip`) — 프리미엄 기능 후보
- **QR 코드 생성** — 오프라인 공유 시 UX
- **URL shortener 자체 구축** — nanoid 짧지만 더 짧게? bit.ly 수준(6~8자) 필요하면 재검토

## 참고 링크

- [nanoid GitHub](https://github.com/ai/nanoid)
- [nanoid Collision Calculator](https://zelark.github.io/nano-id-cc/)
- [ADR-0014 공유 토큰 결정](../decisions/0014-share-link-token-uuid.md)
- [RFC 4122 — UUID 명세](https://datatracker.ietf.org/doc/html/rfc4122)
- [Birthday Paradox 시각화](https://en.wikipedia.org/wiki/Birthday_problem)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
