# ADR-0005: 문서 publishing 시스템 — Notion + 자체 sync 스크립트

> **상태**: ✅ Accepted (확정 2026-05-24)
> **날짜**: 2026-05-24
> **결정자**: @sikkzz (제안: Claude)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [PROJECT_ROOT 5장 문서화 운영](../PROJECT_ROOT.md), [학습 노트: notion-sync-automation](../learnings/notion-sync-automation.md)

---

## 맥락 (Context)

PROJECT_ROOT 5장에서 결정된 운영 방식:

> **1인 풀팀 + 문서 자동화** — 사용자는 마크다운을 직접 쓰지 않음. Claude가 작성하고, 사용자는 프롬프팅/리뷰/수정 요청만 담당.

이 운영 방식의 두 번째 축이 필요: **레포에 쌓인 마크다운을 사람이 읽기 좋은 형태로 publish**.

요구사항:

1. **사용자가 수동 작업 X** — repo에 마크다운만 추가하면 자동 publish
2. **사내 도입 가능 prototype** — 본인이 사내에 제안할 위키 자동화의 실험장
3. **학습 가치** — 외부 API 통합 + 자동화 워크플로 경험
4. **단방향** — repo가 source of truth, publish 대상은 read-only mirror
5. **무료 또는 거의 무료** — 사이드 비용 부담 X

## 결정 (Decision)

**선택**: ✅ **Notion + 자체 sync 스크립트 (Node.js + @notionhq/client)**

세부:

- **Publish 대상**: Notion 워크스페이스 (개인 무료 plan)
- **Sync 방향**: 단방향 (Git → Notion)
- **트리거**: GitHub Actions (main 푸시 + `docs/**` 변경 시 + workflow_dispatch)
- **구조**: 폴더별 sub-page 그룹 (Learning Notes / ADR / Specs / PROJECT_ROOT)
- **변환**: 자체 Markdown → Notion Blocks 매퍼 (제목/목록/코드/표/링크/인용)
- **Idempotency**: 매 실행 전체 upsert. 같은 이름 페이지 있으면 update, 없으면 create.

## 이유 / 트레이드오프

### 왜 Notion인가

#### 1. **사내 도입 가능성 (가장 중요)** ⭐

- 실무 환경가 이미 Notion 기반 위키 운영 중 (PROJECT_ROOT 5장 운영 방식 prototype의 핵심 동기)
- Trailog에서 검증한 자동 sync 패턴을 **회사에 그대로 제안 가능**:
  - "팀 위키가 노션에 있는데 코드는 GitHub에 있다. 이 둘 사이가 단절돼 있다"
  - → "PR 머지 시 자동으로 ADR/runbook이 Notion에 publish되는 시스템을 만들면, 코드 리뷰의 산출물이 위키에 자동 축적된다"
- GitBook/Confluence/MkDocs는 사내에 새 도구를 들이는 비용 추가 발생. Notion은 기존 자산 활용.

#### 2. **자체 스크립트 = 학습 가치 + 어필 풀**

- `@tryfabric/martian` 같은 라이브러리 쓰면 1줄 변환 → 학습 가치 X
- 자체 스크립트로 작성:
  - **Notion API 본격 학습** (Page / Block / Database 모델, page sharing 인증 패턴)
  - **Markdown AST 처리** (또는 정규식 기반 단순 파서)
  - **Idempotent upsert 패턴** (실세계 데이터 동기화 일반 패턴)
  - **Rate limit 대응** (3 req/s 제한, exponential backoff)
- → 학습 토픽/포트폴리오에서 "Notion sync 자동화 직접 만들었다"가 단순 라이브러리 사용보다 훨씬 풀어낼 거리 많음

#### 3. **사용자 본인이 이미 Notion 헤비 유저**

- 학습 노트/리서치를 Notion에 따로 정리하는 습관 — sync 결과를 자연스럽게 활용 가능
- 모바일/태블릿에서도 읽기 좋음 (마크다운 raw는 GitHub 모바일 앱 가독성 떨어짐)

#### 4. **비용 0**

- Notion 개인 무료 plan: 무제한 페이지/블록
- Notion API: 무료, rate limit (3 req/s)만 준수
- GitHub Actions: public repo는 무제한, private도 월 2,000분 무료 (sync는 회당 ~30초)

### 얻는 것

- **외부 API 통합 경험** — auth (Internal Integration), pagination, rate limit, retry
- **GitHub Actions Secrets 운영** — production-like 시크릿 관리
- **Idempotent sync 패턴** — 실세계 흔한 요구사항 (e.g. Airtable/Notion/Salesforce 동기화)
- **사내 도입 prototype** — 검증된 자동화 패턴을 사내 제안 가능
- **사용자 자산 통합** — Notion에 흩어진 학습/리서치와 자연스럽게 합류

### 포기하는 것

- **양방향 sync** — Notion에서 편집한 내용이 git으로 안 옴
  - **대응**: Notion은 read-only로 본다. 수정은 repo에서만.
- **Notion 100% 표현력** — toggle, callout, embed 등 일부 블록은 markdown에 표현 X
  - **대응**: 자주 쓰는 8~10종 (제목/목록/코드/표/링크/인용/구분선) 지원. 나머지는 plain text fallback.
- **즉시 반영** — push → Actions → sync, ~1~2분 지연
  - **대응**: 위키는 실시간성 요구 X. 충분.
- **마크다운 → 블록 매퍼 유지보수** — Notion API 변경 시 대응 필요
  - **대응**: API 안정 (3년+ 거의 호환). 그래도 학습 노트에 한계 명시.

### 학습 가치 관점

- 학습 영역 1번 (인프라/DevOps) — GitHub Actions 깊이 + secrets 운영
- 사내 도입 prototype — PROJECT_ROOT 5장 운영 방식의 두 번째 축 완성
- 학습 토픽 시그널 — "1인 풀팀 자동화 시스템 직접 구축" 스토리 풍부

## 검토한 대안

| 대안                                  | 장점                                                          | 단점                                                                              | 제외 이유                                      |
| ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| **A. Notion + 자체 스크립트** ⭐      | 사내 도입 직결, 학습 가치 大, 비용 0, 본인 Notion 자산과 합류 | 마크다운→블록 매퍼 자체 작성, Notion 블록 표현력 일부 손실                        | (선택안)                                       |
| B. Notion + `@tryfabric/martian`      | 마크다운→블록 변환 위탁, 셋업 빠름                            | 학습 가치 ↓, 라이브러리 의존성, custom 처리 어려움                                | 학습 가치 단절                                 |
| C. GitHub Pages (Docusaurus/MkDocs)   | 무료, GitHub 통합 자연스러움, 검색/네비 좋음                  | 모바일 가독성 보통, 사내 도입 가치 X (실무가 Docusaurus 안 씀), 새 도구 학습 비용 | 사내 prototype 가치 부재                       |
| D. GitBook                            | 마크다운 ↔ 자동 sync, 디자인 좋음                             | 무료 plan 제약 큼, 사내 도입 가치 X (참조 미사용), vendor lock-in                 | 사내 활용성 ↓                                  |
| E. Confluence                         | 엔터프라이즈 표준, 사내 채택 흔함                             | 무료 plan 미비, API 무겁고 학습 가치 떨어짐, 실무 환경가 Notion 사용              | 실무가 Notion이라 prototype 가치 X             |
| F. publish 안 함 (GitHub README/wiki) | 0 구현, 0 유지보수                                            | 자동화 학습 가치 X, 사내 prototype X, 모바일 가독성 ↓                             | 본 ADR의 동기 자체가 publish 자동화이므로 모순 |
| G. Notion AI Connector (공식)         | Notion이 직접 GitHub repo 연결                                | 1) 유료 enterprise만 2) 우리가 원하는 폴더 구조 매핑 제어 X 3) 학습 가치 X        | 무료 plan 미지원 + 학습 단절                   |

## 결과 / 영향

### 신규 파일

- `scripts/sync-to-notion.mjs` (신규) — sync 스크립트 본체
- `.github/workflows/notion-sync.yml` (신규) — 자동 트리거 워크플로
- `docs/learnings/notion-sync-automation.md` (신규) — 학습 노트

### 변경 파일

- `package.json` (루트) — devDependency 추가 (`@notionhq/client`, `gray-matter`) + script (`sync:notion`)
- `docs/PROJECT_ROOT.md` — 4장 인프라 표에 "문서 publish" 행 추가 + 11장 변경 이력
- `docs/specs/phase-01-bootstrap.md` — Q7로 docs publishing 결정 추가 또는 4.6 문서 섹션 확장

### GitHub Secrets 신규 등록 (본인)

- `NOTION_TOKEN` — Notion Integration Internal Integration Secret
- `NOTION_PARENT_PAGE_ID` — Notion Trailog 페이지 ID (32자리)

### 운영 영향

- 본인이 ADR/spec/학습 노트 작성 후 main 머지하면 ~1~2분 내 Notion 반영
- Notion 페이지는 read-only처럼 다룸 (수정은 repo에서만)
- 매월 sync 동작 + Notion 페이지 상태 점검 1회 권장 (15분)

### Phase 4 (사내 도입 prototype)

이 ADR의 두 번째 축 — 사내에 제안할 수 있는 형태:

- 사내 sync는 양방향이 필요할 수도 있음 (위키 → repo) → 별도 검토
- 엔터프라이즈 plan은 webhook 활용 가능 → 즉시 sync
- 본 prototype은 "단방향만으로도 70% 가치 회수" 증명용

## 재검토 트리거

다음 중 하나라도 발생하면 이 결정을 재검토:

- **Notion API 가격 정책 변경** (현재 무료 → 유료 전환)
- **무료 plan 페이지/블록 제한 도달** (현재 무제한, 변경 가능성 낮음)
- **마크다운 → 블록 매퍼 유지보수 부담 큼** → `@tryfabric/martian` 같은 라이브러리로 전환 검토
- **양방향 sync 필요성 발생** (사내 도입 시) → 별도 ADR 또는 라이브러리 검토
- **실무가 Notion 외 도구로 위키 이전** → 이 prototype 가치 재평가

## 후속 작업

- [x] Notion 워크스페이스 + 페이지 생성 (사용자)
- [x] Notion Integration 생성 + 페이지 invite (사용자)
- [ ] GitHub Secrets 등록 (`NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`) (사용자)
- [ ] `scripts/sync-to-notion.mjs` 작성 (Claude)
- [ ] `.github/workflows/notion-sync.yml` 작성 (Claude)
- [ ] `package.json` 의존성 + script 추가 (Claude)
- [ ] 학습 노트 작성 (Claude)
- [ ] PROJECT_ROOT 4장 + 11장 + Phase 1 spec 업데이트
- [ ] 로컬 1회 테스트 sync 검증
- [ ] commit + push (사용자 확인 후)

## 참고

- [Notion API 공식 docs](https://developers.notion.com/)
- [Notion API rate limits](https://developers.notion.com/reference/request-limits)
- [@notionhq/client (공식 SDK)](https://github.com/makenotion/notion-sdk-js)
- [@tryfabric/martian (검토 후 미선택)](https://github.com/tryfabric/martian)
- 관련 ADR: 본 ADR은 모든 기존 ADR과 독립 (publish 결정은 코드/인프라와 직교)
