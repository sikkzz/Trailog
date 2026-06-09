# ADR-0013: RBAC 패턴 — 단일 Guard + Role Decorator

> **상태**: **보류 (Deferred) — 2026-06-09**. 동행자 시스템 자체가 Trailog 도메인 fit X로 Phase 3에서 제외 — 본 ADR 채택도 자연 보류. **활성 트리거**: 동행자 시스템 재검토 시점 (서비스 고도화 / 사용자 피드백 / Phase 4+).
> **날짜**: 2026-06-09
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 3 Spec](../specs/phase-03-sharing.md), [메모리 auth-deep-dive-revisit](../../../../.claude/projects/-Users-sling-Desktop-sling-Trailog/memory/auth-deep-dive-revisit.md)

---

## ⚠️ 보류 사유 (2026-06-09)

**Phase 3 wave 5.1 진입 직전 본인 의문 제기** — "동행자 시스템이 꼭 필요한가?"

검토 결과:

- **Trailog 도메인 정의(PROJECT_ROOT 결정 1)**: "본인 박제 본질". 동행자는 "추가" 영역.
- **유사 서비스 패턴**: Day One(혼자 일기 + 단방향 공유) ≈ Trailog 자연 fit. Apple Photos/구글 포토(collaborator)는 협업 도구. Trailog는 일기형.
- **본인 결정**: "꼭 필요한 기능은 아닌 거 같아 우선 냅두고 넘어가자. 이후 서비스 고도화 단계에 고민".

→ 동행자 시스템 + MomentMember entity + 초대/수락 흐름 모두 **보류**. 본 ADR도 자연 보류.

**Phase 3에선 대신**: 단순 owner 검사(`moment.userId === req.user.id`) — Guard 1개 또는 service 단 직접 검사. 다층 RBAC 패턴은 동행자 시스템 활성 시점에 본 ADR 채택.

## ✅ 재활성 트리거

다음 시점에 본 ADR 다시 들여다보기:

- **사용자 피드백** — "여러 명이 같이 박제하고 싶다" 명시적 요청
- **운영 진입(Phase 4+)** — 사용자 행동 분석 후 협업 가치 검증
- **공유 링크 → 동행자 자연 진화** — 공유 받은 사용자가 "나도 사진 추가하고 싶다" 패턴 발견
- **본인 능동 결정** — 사이드 학습 다양화 또는 참조 다층 가드 9개 패턴 정복 시점

활성 시 본 ADR 그대로 채택 가능 — entity 구조 + decorator + Guard 패턴 모두 그대로.

---

## 맥락 (Context)

Phase 3 사진 공유 wave 진입 시 Moment 권한 모델 필요:

- **owner** (생성자) — 모든 권한
- **contributor** (동행자 — 사진 추가 OK)
- **viewer** (read-only — 공유 링크 + 일부 동행자)

모든 Moment/Photo API 엔드포인트에 권한 체크 박혀야 함. NestJS Guard 패턴 선택:

1. **단일 Guard + Role decorator** (`@RequireMomentRole('owner')` + `Reflector`)
2. **다층 Guard 9개** (참조 패턴 — `AuthGuard` + `RoleGuard` + `MomentAccessGuard` + ...)
3. **각 컨트롤러 메서드 내부 직접 검사** (Guard 미사용)

참조 패턴은 메모리 `auth-deep-dive-revisit`에 박혀있는 9개 Guard 분리 — 강력하지만 1인 사이드 + Trailog 3 role만으론 과함.

## 결정 (Decision)

**선택**: **단일 `MomentRoleGuard` + `@RequireMomentRole(...roles)` decorator + NestJS `Reflector` 패턴**.

## 이유 / 트레이드오프

### 왜 단일 Guard + decorator인가

- **NestJS 표준** — Reflector + SetMetadata + Guard 조합은 docs 공식 패턴.
- **Trailog scale fit** — 3 role만 (owner/contributor/viewer). 다층 Guard 9개는 과함.
- **명시적 + 한 곳** — 컨트롤러 메서드 위에 `@RequireMomentRole('owner')` 박혀 의도 명확. 검사 로직은 한 Guard에 집중.
- **테스트 단순** — Guard 1개 unit test + 메서드별 decorator만 mock.
- **참조 다층 패턴은 메모리에 박혀 추후 검토** (Phase 4+ 권한 복잡도 ↑ 시점에 트리거).

### 얻는 것

- 명시적 권한 표현 (메서드 위 decorator 한 줄)
- 단일 Guard로 모든 권한 검사 통합 → 유지보수 ↓
- NestJS 학습 영역 — Reflector + SetMetadata 패턴 정복
- 추후 role 확장 시 enum 하나만 늘리면 됨

### 포기하는 것

- 복잡한 다층 권한 (예: AND/OR 조합, 시간 기반, IP 기반) — 참조 패턴이 더 유연
- 권한 검사 분리 — 모든 검사가 한 Guard에 집중 → Guard 1개 크기 ↑ 가능성 (4~5 role 넘어가면 SplitGuard 검토)

### 학습 가치 관점

- **NestJS Reflector + SetMetadata 패턴** — 표준 데코레이터 메타데이터 흐름 정복
- **참조 9 Guard 비교 학습** — 메모리 `auth-deep-dive-revisit` 활성화 시점에 학습 노트로 박제 (참조 패턴 분석 + Trailog 채택 사유)
- **점진 진화 학습** — 단순 1 Guard → 복잡 N Guard 진화 과정을 직접 경험. 참조 9 Guard도 처음엔 1개로 시작했을 것.

## 검토한 대안

| 대안                              | 장점                                            | 단점                                               | 제외 이유                                                                   |
| --------------------------------- | ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| **A. 단일 Guard + decorator** ⭐  | NestJS 표준 + 명시적 + 단순 + Trailog scale fit | 4~5 role 넘어가면 Guard 크기 ↑                     | (채택)                                                                      |
| B. 다층 Guard 9개 (참조 패턴)     | 강력 + 분리 명확 + 복잡 권한 조합 가능          | 1인 사이드 + 3 role엔 과함 + 학습 곡선 ↑           | 메모리 `auth-deep-dive-revisit`에 박혀 Phase 4+ 권한 복잡도 ↑ 시점에 재검토 |
| C. 컨트롤러 메서드 내부 직접 검사 | Guard 인프라 불필요                             | 분산 (모든 메서드에 박힘) + 일관 X + 테스트 어려움 | 안티패턴                                                                    |
| D. CASL/AccessControl 라이브러리  | 권한 로직 declarative 표현                      | 외부 의존 + 학습 곡선 + 1인 사이드 over            | NestJS 표준이 충분. lib 도입은 권한 복잡도 ↑ 시점                           |

## 결과 / 영향

### 백엔드 (`apps/server/`)

#### Moment 권한 모델 (Phase 3 5.1)

```typescript
// moments/entities/moment-member.entity.ts (신규)
@Entity({ name: 'moment_members', comment: 'Moment 동행자 권한' })
export class MomentMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Moment) @JoinColumn({ name: 'moment_id' }) moment: Moment;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;

  @Column({ type: 'enum', enum: MomentRole, comment: '권한 — owner/contributor/viewer' })
  role: MomentRole;

  @CreateDateColumn() createdAt: Date;
}

export enum MomentRole {
  OWNER = 'owner',
  CONTRIBUTOR = 'contributor',
  VIEWER = 'viewer',
}
```

#### Decorator + Guard 패턴

```typescript
// common/decorators/require-moment-role.decorator.ts
export const MOMENT_ROLES_KEY = 'momentRoles';
export const RequireMomentRole = (...roles: MomentRole[]) =>
  SetMetadata(MOMENT_ROLES_KEY, roles);

// common/guards/moment-role.guard.ts
@Injectable()
export class MomentRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(MomentMember) private membersRepo: Repository<MomentMember>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<MomentRole[]>(
      MOMENT_ROLES_KEY,
      ctx.getHandler(),
    );
    if (!requiredRoles) return true; // decorator 안 박힌 메서드는 통과

    const req = ctx.switchToHttp().getRequest();
    const userId = req.user.id;
    const momentId = req.params.momentId ?? req.params.id;

    const member = await this.membersRepo.findOne({
      where: { moment: { id: momentId }, user: { id: userId } },
    });

    if (!member) throw new ForbiddenException('Moment 권한 없음');
    return requiredRoles.includes(member.role);
  }
}

// 컨트롤러 사용
@Controller('moments')
@UseGuards(JwtAuthGuard, MomentRoleGuard)
export class MomentsController {
  @Get(':id')
  @RequireMomentRole(MomentRole.OWNER, MomentRole.CONTRIBUTOR, MomentRole.VIEWER)
  findOne(@Param('id') id: string) { ... }

  @Post(':id/members')
  @RequireMomentRole(MomentRole.OWNER) // owner만 동행자 초대 가능
  inviteMember(@Param('id') id: string, @Body() dto: InviteDto) { ... }
}
```

#### 영향

- 모든 Moment/Photo API에 `@RequireMomentRole(...)` 박혀야 함 (Phase 2 4.3~4.6 기존 endpoint 일괄 갱신)
- DB: `moment_members` 테이블 신규 + `Moment.userId` (owner)와 함께 권한 관리
- 마이그레이션: 기존 Moment의 owner를 `moment_members`에 owner role로 자동 박기

### 모바일 (`apps/mobile/`)

- 권한 정보 lib에 추가 (예: `useMomentRole(momentId)`)
- 권한별 UI 분기 (예: viewer는 ＋사진 버튼 안 보임)
- 권한 거부 시 ErrorState (`auth-deep-dive-revisit` 트리거)

## 재검토 트리거

- **4~5 role 넘어감** — 단일 Guard 크기 ↑ → SplitGuard 또는 CASL 도입 검토
- **시간 기반 / IP 기반 / 다중 자원 권한** 필요 — 참조 다층 Guard 패턴 채택
- **Phase 4+ 사용자 1000명+ 운영** — 참조 9 Guard 패턴 본격 비교 (메모리 `auth-deep-dive-revisit` 트리거)
- **CASL/AccessControl lib 도입 가치 ↑** — 권한 로직 declarative 표현 필요 시

## 참고

- [NestJS — Authorization](https://docs.nestjs.com/security/authorization)
- [NestJS — Custom decorators](https://docs.nestjs.com/custom-decorators)
- [Phase 3 Spec](../specs/phase-03-sharing.md) — 4.5 권한 모델 AC
