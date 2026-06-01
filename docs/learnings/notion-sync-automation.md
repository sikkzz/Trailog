# Notion sync 자동화 (Markdown → Notion publish)

> **작성일**: 2026-05-24
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 1번 인프라/DevOps (외부 API 통합 + GitHub Actions 운영)
> **관련 문서**: [ADR-0005 docs publishing](../decisions/0005-docs-publishing-notion-sync.md), [Phase 1 Spec](../specs/phase-01-bootstrap.md)

---

## 한 줄 요약

레포의 `docs/*.md`를 GitHub Actions가 자동으로 Notion 워크스페이스의 sub-page들로 publish하는 단방향 sync 시스템. **사내 위키 자동화 prototype** 겸 **외부 API 통합 학습** 1차 실전.

## 우리 프로젝트에서 어디에 쓰이는가

- **Phase 1** 마지막 인프라 항목 — PROJECT_ROOT 5장 "1인 풀팀 + 문서 자동화" 운영 방식의 두 번째 축
- Trailog `docs/` 의 ADR / Specs / Learning Notes / PROJECT_ROOT를 Notion에 자동 mirror
- 트리거: main 브랜치에 `docs/**` 변경 푸시 + 수동 trigger (Actions 탭)
- **2차 목표**: 검증된 패턴을 실무 환경 Notion 위키에 도입 제안

## 어떻게 동작하는가

```mermaid
sequenceDiagram
    participant Dev as 개발자
    participant Git as GitHub Repo
    participant GA as GitHub Actions
    participant Script as sync-to-notion.mjs
    participant Notion as Notion API

    Dev->>Git: docs/*.md 수정 + main 푸시
    Git->>GA: workflow trigger (paths: docs/**)
    GA->>GA: pnpm install (캐시 활용)
    GA->>Script: node scripts/sync-to-notion.mjs
    Script->>Script: docs/ walk + markdown 파싱
    loop 각 파일/폴더
      Script->>Notion: GET children (기존 page 찾기)
      Notion-->>Script: 기존 페이지 목록
      alt 같은 제목 페이지 존재
        Script->>Notion: DELETE 기존 children
        Script->>Notion: POST 새 children
      else 없음
        Script->>Notion: POST 새 페이지
        Script->>Notion: POST children blocks
      end
    end
    Script-->>GA: 완료
    GA-->>Dev: 상태 표시 (✅/❌)
```

### 핵심 개념

#### 1. Notion 데이터 모델 (Page vs Block vs Database)

Notion API는 세 종류의 객체로 모든 콘텐츠를 표현:

- **Page**: 페이지 자체. URL, 제목, 메타데이터, 부모 등 보유
- **Block**: 페이지 안의 요소 (단락, 제목, 리스트, 표, 코드 등). 페이지의 콘텐츠는 사실상 "블록의 리스트".
- **Database**: 구조화된 컬렉션 (테이블). 우리 publish엔 사용 X (단순 페이지 트리만).

이 프로젝트는 **Page + Block** 두 가지만 사용. Database는 추후 "Activity feed", "ADR index" 같은 정형 데이터 publish 시 검토.

#### 2. Integration 인증 모델 (Internal vs OAuth)

Notion API는 두 가지 인증:

- **Internal Integration**: 단일 워크스페이스 내 사용. 토큰(secret) 발급 후 페이지에 명시적으로 invite. **우리가 사용하는 방식.**
- **OAuth**: 마켓플레이스 앱용. 다른 사용자 워크스페이스 접근 시.

**중요 함정**: Integration이 만들어졌다고 모든 페이지에 접근 가능한 게 아님. **각 페이지에 명시적으로 invite** 해야 함 (`...` → 연결 → integration 선택). 안 하면 API 호출 시 `object_not_found` 404.

#### 3. 단방향 sync (Repo → Notion)

선택지:

- **단방향 (Repo → Notion)**: 우리가 선택. Repo는 source of truth, Notion은 read-only mirror.
- **양방향**: Notion 수정 → Git에 반영. 충돌 해결 복잡, 학습 가치 크지만 MVP엔 과함.

장점:

- 충돌 X, 로직 단순
- "Notion에서 수정하지 말 것"이라는 일관성 있는 규칙

단점:

- Notion 댓글/협업 결과가 코드로 안 옴
- 향후 사내 도입 시엔 양방향 필요할 수도 (별도 ADR로)

#### 4. Idempotent upsert

같은 입력으로 여러 번 실행해도 결과가 동일해야 함.

전략:

```typescript
for (const file of docs) {
  const existing = await findPageByTitle(parent, file.title);
  if (existing) {
    await deleteAllChildren(existing.id); // 기존 content 비움
    await appendBlocks(existing.id, newBlocks); // 새 content 추가
  } else {
    const page = await createPage(parent, file.title);
    await appendBlocks(page.id, newBlocks);
  }
}
```

**왜 update가 아니라 delete-then-append**?

- Notion API에 "페이지 콘텐츠 전체 교체" 단일 호출이 없음
- block 단위 update는 type 변경 불가 (paragraph → heading 같은)
- delete-then-append가 가장 일관성 보장

**부작용**:

- block ID가 매번 새로워짐 → Notion 내부 백링크/북마크 깨질 수 있음
- 페이지 ID 자체는 보존 (제목 기준 매칭) → 외부 링크는 안전

#### 5. Notion API rate limit

- **3 requests/second** 평균
- 초과 시 `rate_limited` 429
- 대응: 요청 간 350ms 대기 (`sleep`)
- 더 정교한 방식: 토큰 버킷, exponential backoff. 우리 sync는 가벼워 단순 sleep으로 충분.

#### 6. 100 block batch 제약

- 한 번의 `blocks.children.append` 요청에 최대 100개 child block
- 우리 파일 중 PROJECT_ROOT 같이 큰 건 100+ block — batch 분할 필요

```typescript
for (let i = 0; i < blocks.length; i += 100) {
  const batch = blocks.slice(i, i + 100);
  await notion.blocks.children.append({ block_id: pageId, children: batch });
}
```

#### 7. Markdown → Notion blocks 변환

표준 마크다운엔 있는데 Notion엔 없는 것 / 그 반대:

| 마크다운                | Notion                 | 매핑 방식                                    |
| ----------------------- | ---------------------- | -------------------------------------------- | ----------------- | ---------------------------- |
| `# H1` ~ `### H3`       | heading_1/2/3          | 직접 매핑                                    |
| `#### H4+`              | **없음**               | bold paragraph로 fallback                    |
| `- item`                | bulleted_list_item     | 직접                                         |
| `1. item`               | numbered_list_item     | 직접                                         |
| `- [ ] task`            | to_do                  | 직접                                         |
| `> quote`               | quote                  | 직접                                         |
| `---`                   | divider                | 직접                                         |
| <code>\`\`\`lang</code> | code                   | 언어 매핑 + plain text fallback              |
| `                       | table                  | `                                            | table + table_row | parse 후 cell 단위 rich_text |
| `**bold**`              | annotation.bold        | rich_text 안 annotation                      |
| `*italic*`              | annotation.italic      | 동일                                         |
| `` `code` ``            | annotation.code        | 동일                                         |
| `[link](url)`           | rich_text + link       | 동일                                         |
| Mermaid 다이어그램      | code(language=mermaid) | Notion이 mermaid 지원 (최근)                 |
| 이미지 `![](url)`       | image block (외부 URL) | repo-local 이미지는 안 됨 (별도 호스팅 필요) |

### 코드 예시 (핵심 부분만)

```typescript
// scripts/sync-to-notion.mjs

const notion = new Client({ auth: NOTION_TOKEN });

// Idempotent upsert
async function upsertLeafPage(parentId, title, blocks) {
  const existing = await listChildPages(parentId);
  const found = existing.find((p) => p.title === title);

  let pageId;
  if (found) {
    pageId = found.id;
    await clearPageContent(pageId); // 기존 콘텐츠 비움
  } else {
    const res = await notion.pages.create({
      parent: { page_id: parentId },
      properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
    });
    pageId = res.id;
  }

  // 100개씩 batch로 children 추가
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + 100),
    });
  }
}
```

## 왜 다른 선택지가 아닌 이걸 골랐나

자세한 비교는 [ADR-0005](../decisions/0005-docs-publishing-notion-sync.md). 요약:

| 대안                      | 제외 이유                                               |
| ------------------------- | ------------------------------------------------------- |
| `@tryfabric/martian`      | 학습 가치 단절 (마크다운→블록 변환을 라이브러리에 위임) |
| GitHub Pages (Docusaurus) | 사내 도입 가치 X (실무가 Docusaurus 안 씀)              |
| GitBook                   | 무료 plan 제약 + 참조 미사용                            |
| Confluence                | 실무가 Notion 기반이라 prototype 가치 X                 |

**선택: Notion + 자체 스크립트** = 사내 도입 직결 + 학습 가치 + 비용 0

## 흔한 함정 / 주의할 점

### 1. ⚠ Integration 페이지 invite 빠뜨림

가장 흔한 실패. Integration 만들었어도 페이지에 invite 안 하면:

```
NotionAPIResponseError: Could not find block with ID: xxx. Make sure the
relevant pages and databases are shared with your integration.
```

→ Notion 페이지 → `...` → 연결 → integration 선택

### 2. ⚠ NOTION_PARENT_PAGE_ID 형식

- URL 끝의 32자리. 하이픈 포함/제외 둘 다 작동.
- workspace prefix 잘못 복사하면 안 됨.
  - `https://www.notion.so/My-Workspace/Trailog-abc123...` 에서 마지막 32자리만.
- workspace ID(다른 페이지의 ID) 와 헷갈리기 쉬움 — Trailog 페이지 자체 URL에서 추출해야.

### 3. ⚠ Rate limit (3 req/s)

- sync 중 갑자기 `rate_limited` 429 뜨면 sleep 늘리기
- 큰 문서가 많으면 sync 시간 길어짐 (~30초 ~ 몇 분)
- 더 빠르게 하려면 병렬 호출 + 토큰 버킷 알고리즘 필요 (이 prototype은 안 함)

### 4. ⚠ block 길이 제약 (2000자)

- 한 rich_text 객체 최대 2000자. 초과하면 `validation_error`
- 우리 코드는 chunk 분할로 대응. paragraph 본문 자체가 2000자 넘으면 잘림.
- 일반적으로 문제 없음 (한 문단이 2000자는 드뭄)

### 5. ⚠ child_page 삭제 시 영구 삭제 X

- API의 `blocks.delete`는 휴지통(Trash)으로 이동만 함
- 영구 삭제는 별도 호출 필요
- 우리는 update 시 child를 삭제하는데, 휴지통이 점차 쌓일 수 있음 (월 1회 수동 비우기 또는 무시)

### 6. ⚠ block 종류 변경 안 됨

- 기존 paragraph block을 heading으로 update 불가
- 그래서 우리는 delete + create 패턴 사용 (block 단위 in-place update X)

### 7. ⚠ 빈 rich_text 배열

- 일부 block type은 `rich_text: []` 비어있으면 validation_error
- 안전 패턴: 빈 텍스트라도 `[{ type: 'text', text: { content: '' } }]` 하나 넣기

## 더 파볼 거리 (선택)

지금은 안 다루지만 나중에 깊이 갈 만한 주제:

- **양방향 sync** — Notion API webhook (Enterprise plan만) 또는 polling으로 Notion 변경을 git으로
- **Notion AST 처리** — 우리는 정규식 기반 단순 파서. 본격은 [remark](https://github.com/remarkjs/remark) AST → Notion blocks 매퍼.
- **Database publish** — ADR/Spec을 properties (Status, Date, Author) 있는 Notion database로
- **이미지 publish** — `docs/screens/images/` 의 캡처를 Cloudflare R2 / S3에 업로드 후 Notion에 image block으로
- **사내 도입 시 양방향 충돌 해결** — last-write-wins / 사람 개입 / Git의 변경을 우선
- **Database publish** vs **Page publish** — Notion Database로 publish 시 properties(Status/Date/Author) 추가 가능
- **content hash 기반 변경 감지** — 우리는 git diff 사용. 더 정교한 방식은 각 파일 SHA-256 → Notion property에 저장 → 비교

## 참고 링크

- [Notion API 공식 docs](https://developers.notion.com/)
- [Notion API reference (blocks)](https://developers.notion.com/reference/block)
- [Notion API rate limits](https://developers.notion.com/reference/request-limits)
- [@notionhq/client GitHub](https://github.com/makenotion/notion-sdk-js)
- [gray-matter (frontmatter 파싱)](https://github.com/jonschlinkert/gray-matter)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

### 2026-05-26 추가 — 증분 sync (git diff 기반 incremental)

#### 왜 추가했나

초기 구현은 매 트리거마다 전체 docs 재작성. 사이드 페이스에 부담은 없지만:

- 1개 파일 변경에 모든 페이지 재작성 → ~95% 낭비
- 1~2분 sync 시간 → 안 줄여도 되긴 하지만 비효율
- block ID가 매번 새로워짐 → Notion 내 백링크 깨질 가능성

본인 관찰: "sync 매번 새로 작성하는 거 같은데 시간이 오래 걸린다" — 정당한 지적.

#### 해결 패턴: GitHub Actions의 git diff 활용

```mermaid
flowchart TD
    A[main 푸시] --> B{event.before<br/>== zeros?}
    B -->|Yes initial push| C[전체 sync]
    B -->|No| D[git diff before..sha<br/>-- docs/**.md]
    D --> E{변경 파일 있나?}
    E -->|No| F[paths 필터로<br/>워크플로 자체 안 돔]
    E -->|Yes| G[SYNC_CHANGED_FILES<br/>환경변수 전달]
    G --> H[스크립트가<br/>해당 파일만 sync]

    I[workflow_dispatch] --> J{force_full_sync?}
    J -->|Yes| C
    J -->|No| C
```

수동 트리거(`workflow_dispatch`)는 안전상 항상 전체 sync. 보통 "뭔가 깨진 거 같아서 다시 돌리고 싶을 때" 누르므로.

#### 핵심 로직

**Workflow** (`.github/workflows/notion-sync.yml`):

```yaml
- name: Determine changed docs
  id: changed
  run: |
    if [[ initial push 또는 workflow_dispatch ]]; then
      echo "all=true" >> "$GITHUB_OUTPUT"
    else
      CHANGED=$(git diff --name-only "$BEFORE" "$SHA" -- 'docs/**' | grep -E '\.md$' | tr '\n' ',')
      echo "files=$CHANGED" >> "$GITHUB_OUTPUT"
    fi

- name: Sync
  env:
    SYNC_CHANGED_FILES: ${{ steps.changed.outputs.files }}
    SYNC_ALL: ${{ steps.changed.outputs.all }}
```

**스크립트** (`scripts/sync-to-notion.mjs`):

```javascript
const CHANGED_FILES = (process.env.SYNC_CHANGED_FILES ?? '')
  .split(',')
  .filter((p) => p.endsWith('.md') && p.startsWith('docs/'));
const SYNC_ALL = process.env.SYNC_ALL === 'true' || process.argv.includes('--all');
const INCREMENTAL = !SYNC_ALL && CHANGED_FILES.length > 0;

if (INCREMENTAL) {
  // 변경 파일이 속한 폴더만 sync, 그 폴더의 변경 basename만 처리
  // 그룹 페이지(ADR/Specs/Learnings)는 변경 있는 폴더만 upsert
}
```

#### Trade-off 인식

| 항목                    | 전체 sync (이전) | 증분 sync (현재)            |
| ----------------------- | ---------------- | --------------------------- |
| 코드 단순성             | ⭐⭐⭐           | ⭐⭐                        |
| 한 파일 변경 시간       | ~1~2분           | ~10~30초                    |
| 5개 변경 시간           | ~1~2분           | ~30초~1분                   |
| 안전성 (sync 누락 위험) | 0                | git diff 결과 정확도에 의존 |
| 첫 sync / fallback      | 단순             | `SYNC_ALL=true`로 fallback  |

#### 사내 도입 시 추가 고민 거리

- **PR 단위 변경**: main push 외에 PR open 시 preview sync? Notion에 PR별 separate page 또는 staging workspace?
- **충돌**: Notion에서 누가 수정하면? — 우리는 단방향이라 무시. 사내 도입 시 정책 필요.
- **rate limit 가속**: 빌드 캐시 + 병렬 처리 (현재는 직렬 + 350ms 대기).
- **content hash 추가**: 변경 감지는 git diff로 충분하지만, 컨텐츠 동일한데 mtime만 바뀐 케이스 회피 위해 hash 추가 가능.

#### 로컬에서 증분 sync 시도

```bash
# 특정 파일만 sync
SYNC_CHANGED_FILES="docs/learnings/notion-sync-automation.md" pnpm sync:notion

# 강제 전체 sync
pnpm sync:notion -- --all
```

### 2026-06-01 추가 — Archived 페이지 함정 + 근본 fragility 인식

#### 증상

Sync 실행 중 다음 에러로 워크플로 실패:

```
@notionhq/client warn: request fail {
  code: 'validation_error',
  message: "Can't edit block that is archived. You must unarchive the block before editing."
}
```

#### 원인

`listChildPages`가 Notion `blocks.children.list` 결과의 **`archived: true` 블록까지 포함**해 reuse 처리.
사용자가 Notion에서 페이지를 휴지통으로 옮긴 시점에 같은 제목의 페이지가 list 결과에
"archived" 상태로 그대로 보이고, sync 스크립트는 그걸 그대로 update 시도 → API가 거절.

#### 처방 (단기)

`listChildPages`에서 `block.archived === false`인 child_page만 reuse 대상으로 추림.
archived 페이지는 list에서 무시 → `found` 안 됨 → 새 페이지 create.

```javascript
if (block.type === 'child_page' && !block.archived) {
  pages.push({ id: block.id, title: block.child_page.title });
}
```

**왜 자동 unarchive 안 하는가**: 사용자가 archive한 의도 (백업/정리) 자동 거스르는 부작용 회피.
"archived = 삭제된 것" 으로 간주하고 같은 제목의 새 페이지 생성. 휴지통은 사용자가 정리.

#### 더 큰 패턴 인식 — 자체 sync의 본질적 fragility

이번이 도입 후 fix 5번째. 패턴 정리:

| Fix                        | 원인                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| b611d8b JWT link 형식 정정 | 자체 markdown 정규식 파서의 한계                                     |
| 89f4c91 retry wrapper      | Notion API 502/503/429 변덕                                          |
| 이번 archived 필터         | "title로 페이지 매칭"의 한계 (이름 변경/archive/이동 모든 edge case) |

근본 원인 = **idempotent upsert by title** + **자체 markdown 파서** 두 책임이 본질적으로 fragile.
매 fix는 대증요법 — 끝없는 사이클.

#### 처방 (중기) — Phase 2 종료 후 검토

- **frontmatter `notion_page_id` 정착** — 첫 sync 시 ID 발급 → CI가 frontmatter에 박고 git commit back
  → 이후 ID로 직접 `notion.pages.update(id)` → title/archive/이동 무관 (실세계 sync 패턴의 정답)
- **markdown 파서 외부 라이브러리 도입** (`@tryfabric/martian`) — 자체 파서 폐기로 그 영역 fragility 종료
- ADR-0005 재검토 노트 + 마이그레이션 commit 분리
