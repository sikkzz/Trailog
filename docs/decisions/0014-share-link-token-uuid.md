# ADR-0014: 공유 링크 토큰 — random UUID (nanoid)

> **상태**: Accepted
> **날짜**: 2026-06-09
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 3 Spec](../specs/phase-03-sharing.md)

---

## 맥락 (Context)

Phase 3 5.2 공유 링크 wave 진입 시 외부 사용자가 접근하는 토큰 형식 결정:

- 만료 시간 (1시간 / 1일 / 1주 / 영구)
- 비밀번호 보호 옵션
- **즉시 취소 가능**해야 함 (사용자가 share 취소 시점에 무효화)

후보:

1. **random UUID/nanoid** — DB에 토큰 + 메타 박힘
2. **JWT** — self-contained, server-side state X
3. **HMAC** — server secret으로 검증

## 결정 (Decision)

**선택**: **`nanoid` 21자 random token + DB 저장 — `Share` entity**.

## 이유 / 트레이드오프

### 왜 nanoid인가

- **즉시 취소 가능** — DB row 삭제 또는 `revoked: true` flag 한 줄. JWT는 blacklist 필요.
- **만료 시간 + 비밀번호 + 사용자 메타** 모두 DB row에 박힘 — 단순 데이터 모델.
- **충돌 안전** — nanoid 21자(default) collision 확률 천만년에 1회 (1B IDs/sec × 1 trillion years).
- **URL-safe** — alphabet `A-Za-z0-9_-` 기본 (UUID는 `-` 포함 → URL 그대로 OK but 길이 ↑).
- **DB 인덱스 단순** — `token` 컬럼 UNIQUE 인덱스 + B-tree O(log n) 조회.

### 얻는 것

- 즉시 취소 (사용자가 "공유 취소" 누르면 DB row 삭제)
- 만료/비밀번호/통계 등 메타 추가 자유
- 외부 사용자 접근 시 DB 1회 조회로 검증 (Fly.io Postgres + 단일 인덱스 — ms 단위)
- 학습 가치: nanoid + UUID 차이 + 토큰 보안 (entropy / brute force)

### 포기하는 것

- **stateless** — JWT는 DB 조회 X, 토큰 자체 검증. UUID는 DB 1회 필수.
  - 단 share 토큰 검증은 hot path X (외부 사용자 가끔 접근). DB 조회 cost 무시 가능.
- **자체 만료 정보** — JWT는 `exp` 클레임 자체에 박힘. UUID는 DB에서 `expires_at` 조회.

### 학습 가치 관점

- **UUID v4 vs nanoid 비교** — 길이 + URL-safe + 충돌 확률 학습
- **stateless vs stateful 토큰** 트레이드오프 학습
- **brute force 공격** — token 21자(126 bit entropy)는 brute force 사실상 불가능 학습 노트

## 검토한 대안

| 대안             | 장점                                              | 단점                                                                | 제외 이유                                              |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| **A. nanoid** ⭐ | URL-safe + 짧음 (21자) + 즉시 취소 + 단순 DB 모델 | DB 1회 조회 (hot path X라 무시 가능)                                | (채택)                                                 |
| B. JWT           | self-contained + DB 조회 X                        | 즉시 취소 어려움 (blacklist 필요) + 토큰 자체 큼 + 만료 변경 어려움 | share 토큰은 자주 취소 필요 (사용자 즉시 취소). 부적합 |
| C. HMAC          | server secret 검증 + stateless                    | secret rotation 어려움 + 만료 시간 별도 박아야                      | nanoid 대비 이점 X                                     |
| D. UUID v4       | 표준 + ecosystem 풍부                             | 36자 길이 (`-` 포함) + URL 약간 거슬림                              | nanoid 21자가 더 짧고 URL-safe                         |

## 결과 / 영향

### 백엔드 (`apps/server/`)

#### Share entity (Phase 3 5.2)

```typescript
// shares/entities/share.entity.ts (신규)
@Entity({ name: 'shares', comment: '공유 링크 토큰' })
@Index(['token'], { unique: true })
@Index(['expiresAt']) // 만료된 토큰 cleanup용
export class Share {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 21, unique: true, comment: 'nanoid 21자 토큰' })
  token: string;

  @ManyToOne(() => User) @JoinColumn({ name: 'owner_id' }) owner: User;

  @Column({ type: 'enum', enum: ShareTarget, comment: 'photo 또는 moment 단위' })
  target: ShareTarget;

  @Column({ type: 'uuid', name: 'target_id', comment: 'photo.id 또는 moment.id' })
  targetId: string;

  @Column({ type: 'timestamptz', nullable: true, comment: '만료 시각 (null = 영구)' })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 60, nullable: true, comment: 'bcrypt hash (옵션)' })
  passwordHash: string | null;

  @Column({ type: 'boolean', default: false, comment: 'EXIF strip (Phase 3 5.3 연동)' })
  exifStripped: boolean;

  @CreateDateColumn() createdAt: Date;
}

export enum ShareTarget {
  PHOTO = 'photo',
  MOMENT = 'moment',
}
```

#### API

- `POST /shares` — 공유 링크 생성 (인증 + Moment owner Guard)
- `GET /shares/:token` — 외부 사용자 접근 (인증 X, 토큰만)
- `POST /shares/:token/unlock` — 비밀번호 보호 시 unlock (return short-lived JWT for 사진 access)
- `DELETE /shares/:id` — 공유 취소 (인증 + owner Guard)

#### 추가 의존성

- `nanoid` (3kb gzip, MIT, npm 1억+ DL)

### 모바일 (`apps/mobile/`)

- 공유 링크 생성 UI (만료/비밀번호/EXIF strip 옵션)
- 공유 받은 링크는 외부 브라우저 또는 RN 내부 view (Phase 3 5.2 결정)

### 인프라

- 만료된 토큰 cleanup — Phase 4 cron job 검토 (`expires_at < NOW()` 삭제)

## 재검토 트리거

- **공유 링크 사용량 급증** — DB 부담 ↑ 시점에 캐싱 (Redis) 검토
- **stateless 토큰 필요** — Phase 5+ CDN edge에서 검증 필요 시 JWT 전환 검토
- **보안 incident** — 토큰 길이 21자 → 더 길게 (보안 강화)

## 참고

- [nanoid GitHub](https://github.com/ai/nanoid)
- [nanoid collision calculator](https://zelark.github.io/nano-id-cc/)
- [Phase 3 Spec](../specs/phase-03-sharing.md) — 4.2 공유 링크 AC
