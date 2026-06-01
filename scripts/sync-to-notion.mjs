#!/usr/bin/env node
// scripts/sync-to-notion.mjs
//
// docs/ 의 마크다운을 Notion에 publish하는 단방향 sync 스크립트.
// - main 푸시 시 GitHub Actions가 자동 실행 (.github/workflows/notion-sync.yml)
// - 또는 로컬에서 `pnpm sync:notion` (NOTION_TOKEN + NOTION_PARENT_PAGE_ID 환경변수 필요)
// - `pnpm sync:notion:dry` 로 dry-run (Notion 호출 X, 계획만 출력)
//
// 모드:
// - 증분 (incremental): SYNC_CHANGED_FILES 환경변수 (콤마 구분 경로) 있으면 그 파일만 sync
//   GitHub Actions가 git diff로 추출. 로컬에서도 `SYNC_CHANGED_FILES="docs/foo.md,..." pnpm sync:notion` 가능
// - 전체 (full): SYNC_CHANGED_FILES 없거나 SYNC_ALL=true 또는 `--all` flag → 모든 파일 재작성 (초기 sync)
//
// 자세한 설계: docs/decisions/0005-docs-publishing-notion-sync.md
// 학습 노트: docs/learnings/notion-sync-automation.md

import { Client } from '@notionhq/client';
import matter from 'gray-matter';
import { readFile, readdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ----- 환경 / 상수 -----

const DRY_RUN = process.argv.includes('--dry-run');
// --all: 변경 감지 무시하고 강제 전체 sync (env가 있어도 override)
const FORCE_ALL = process.argv.includes('--all');
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;

// SYNC_CHANGED_FILES: GitHub Actions 또는 로컬에서 변경 파일 목록 (comma-separated, repo-root 기준 상대 경로).
// 예: "docs/learnings/foo.md,docs/decisions/bar.md"
// 비어있고 SYNC_ALL=true도 아니면 → 전체 sync (안전한 fallback).
// SYNC_ALL=true: workflow에서 initial push 또는 force_full_sync 시 설정.
const SYNC_CHANGED_FILES_RAW = process.env.SYNC_CHANGED_FILES ?? '';
const SYNC_ALL = process.env.SYNC_ALL === 'true' || FORCE_ALL;

if (!NOTION_TOKEN) {
  console.error('❌ NOTION_TOKEN 환경변수가 필요합니다.');
  process.exit(1);
}
if (!NOTION_PARENT_PAGE_ID) {
  console.error('❌ NOTION_PARENT_PAGE_ID 환경변수가 필요합니다.');
  process.exit(1);
}

// 변경 파일 목록 파싱 (docs/ 안의 .md만). 빈 항목 제거.
const CHANGED_FILES = SYNC_CHANGED_FILES_RAW.split(',')
  .map((p) => p.trim())
  .filter((p) => p && p.endsWith('.md') && p.startsWith('docs/'));

// 증분 모드 여부 — SYNC_ALL이면 false, 변경 파일 목록이 있으면 true.
const INCREMENTAL = !SYNC_ALL && CHANGED_FILES.length > 0;

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DOCS_ROOT = join(REPO_ROOT, 'docs');

// Notion rate limit: 3 req/s. 안전하게 350ms 간격.
const RATE_LIMIT_DELAY_MS = 350;

// Notion API 제약
const MAX_BLOCKS_PER_REQUEST = 100; // children 한 번에 100개까지
const MAX_RICH_TEXT_LENGTH = 2000; // 한 rich_text 객체 최대 2000자
const MAX_TEXT_BLOCK_LENGTH = 2000;

// 폴더 → Notion 그룹 페이지 매핑
const FOLDER_GROUPS = [
  { folder: 'decisions', title: '🏛 ADR (Architecture Decision Records)' },
  { folder: 'specs', title: '🎯 Specs (Feature PRDs)' },
  { folder: 'learnings', title: '📖 Learning Notes' },
];

// 단일 파일로 publish할 root 문서
const ROOT_DOCS = [{ file: 'PROJECT_ROOT.md', title: '🏠 PROJECT_ROOT (북극성)' }];

// 제외할 폴더 (지금은 publish 안 함)
const EXCLUDED_FOLDERS = ['templates', 'screens'];

const notion = new Client({ auth: NOTION_TOKEN });

// ----- 유틸 -----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Notion API 호출 retry wrapper — 일시적 에러(5xx, 429, 네트워크)만 재시도.
 *
 * - 4xx (인증, validation): 재시도 X — 즉시 throw
 * - 5xx (서버 일시 장애): exponential backoff retry
 * - 429 (rate limit): exponential backoff retry
 * - 네트워크 (status 없음): retry
 *
 * 사유: 2026-05-31 502 에러로 sync 실패 경험. Notion API는 502/503 간헐 발생.
 *
 * 사용:
 *   await withRetry(() => notion.pages.create({...}));
 */
async function withRetry(fn, { retries = 3, baseDelayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.status;
      const isRetryable = !status || status >= 500 || status === 429;
      if (!isRetryable || attempt === retries) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(
        `  ⚠️ Notion API 일시 실패 (status ${status ?? 'network'}), ${delay}ms 후 재시도 (${attempt + 1}/${retries})`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

let requestCount = 0;
async function rateLimit() {
  requestCount += 1;
  await sleep(RATE_LIMIT_DELAY_MS);
}

function chunkText(text, max = MAX_RICH_TEXT_LENGTH) {
  if (text.length <= max) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += max) chunks.push(text.slice(i, i + max));
  return chunks;
}

// ----- Markdown → Notion blocks 변환 -----

function makeRichText({ text, link, bold, italic, code, strikethrough }) {
  return chunkText(text).map((chunk) => ({
    type: 'text',
    text: { content: chunk, link: link ? { url: link } : null },
    annotations: {
      bold: bold ?? false,
      italic: italic ?? false,
      strikethrough: strikethrough ?? false,
      underline: false,
      code: code ?? false,
      color: 'default',
    },
  }));
}

// 인라인 마크다운 토큰화. 정규식 기반 단순 파서 (중첩 X 가정).
function tokenizeInline(text) {
  const PATTERNS = [
    { re: /`([^`]+)`/, fmt: (m) => ({ text: m[1], code: true }) },
    { re: /!\[([^\]]*)\]\(([^)]+)\)/, fmt: (m) => ({ text: m[1] || m[2], link: m[2] }) },
    { re: /\[([^\]]+)\]\(([^)]+)\)/, fmt: (m) => ({ text: m[1], link: m[2] }) },
    { re: /\*\*([^*]+)\*\*/, fmt: (m) => ({ text: m[1], bold: true }) },
    { re: /__([^_]+)__/, fmt: (m) => ({ text: m[1], bold: true }) },
    { re: /(?<![*\w])\*([^*\s][^*]*?)\*(?!\w)/, fmt: (m) => ({ text: m[1], italic: true }) },
    { re: /~~([^~]+)~~/, fmt: (m) => ({ text: m[1], strikethrough: true }) },
  ];

  const tokens = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest = null;
    let earliestIdx = remaining.length;
    let earliestPattern = null;

    for (const p of PATTERNS) {
      const m = remaining.match(p.re);
      if (m && m.index < earliestIdx) {
        earliestIdx = m.index;
        earliest = m;
        earliestPattern = p;
      }
    }

    if (earliest === null) {
      tokens.push({ text: remaining });
      break;
    }
    if (earliestIdx > 0) tokens.push({ text: remaining.slice(0, earliestIdx) });
    tokens.push(earliestPattern.fmt(earliest));
    remaining = remaining.slice(earliestIdx + earliest[0].length);
  }

  return tokens;
}

function parseInline(text) {
  const richTexts = [];
  for (const t of tokenizeInline(text)) {
    if (t.text === '') continue;
    richTexts.push(...makeRichText(t));
  }
  return richTexts.length > 0 ? richTexts : [{ type: 'text', text: { content: '' } }];
}

// Notion 코드 블록 지원 언어 (일부만 — 자주 쓰는 것 위주)
const NOTION_LANGUAGES = new Set([
  'bash',
  'c',
  'c#',
  'c++',
  'css',
  'docker',
  'go',
  'graphql',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'makefile',
  'markdown',
  'mermaid',
  'objective-c',
  'php',
  'plain text',
  'powershell',
  'python',
  'ruby',
  'rust',
  'scala',
  'shell',
  'sql',
  'swift',
  'typescript',
  'xml',
  'yaml',
]);

const LANG_ALIAS = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  sh: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  dockerfile: 'docker',
  '': 'plain text',
};

function normalizeLanguage(lang) {
  const l = lang.toLowerCase().trim();
  const aliased = LANG_ALIAS[l] ?? l;
  return NOTION_LANGUAGES.has(aliased) ? aliased : 'plain text';
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

// 마크다운 본문 → Notion blocks
function markdownToBlocks(md) {
  const blocks = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // 코드 블록 ```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      const code = codeLines.join('\n');
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: code.slice(0, MAX_TEXT_BLOCK_LENGTH) } }],
          language: normalizeLanguage(lang),
        },
      });
      continue;
    }

    // 제목 H1~H3
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({
        object: 'block',
        type: `heading_${level}`,
        [`heading_${level}`]: {
          rich_text: parseInline(headingMatch[2]),
          is_toggleable: false,
        },
      });
      i += 1;
      continue;
    }

    // H4+ (Notion 미지원) → bold paragraph fallback
    const h4Match = line.match(/^#{4,}\s+(.+)$/);
    if (h4Match) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: h4Match[1] },
              annotations: { bold: true, color: 'default' },
            },
          ],
        },
      });
      i += 1;
      continue;
    }

    // 구분선
    if (/^---+$/.test(line.trim()) || /^___+$/.test(line.trim())) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      i += 1;
      continue;
    }

    // 인용 (연속된 > 라인)
    if (line.startsWith('> ') || line.trim() === '>') {
      const quoteLines = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: parseInline(quoteLines.join('\n')) },
      });
      continue;
    }

    // 체크박스
    const todoMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
    if (todoMatch) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: parseInline(todoMatch[2]),
          checked: todoMatch[1].toLowerCase() === 'x',
        },
      });
      i += 1;
      continue;
    }

    // 글머리 기호
    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInline(bulletMatch[1]) },
      });
      i += 1;
      continue;
    }

    // 번호 리스트
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInline(numberedMatch[1]) },
      });
      i += 1;
      continue;
    }

    // 표
    if (
      line.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())
    ) {
      const tableRows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableRows.push(lines[i]);
        i += 1;
      }
      const header = parseTableRow(tableRows[0]);
      const dataRows = tableRows.slice(2).map(parseTableRow); // [1]은 정렬 표시 무시
      const allRows = [header, ...dataRows];
      const tableWidth = Math.max(...allRows.map((r) => r.length));

      blocks.push({
        object: 'block',
        type: 'table',
        table: {
          table_width: tableWidth,
          has_column_header: true,
          has_row_header: false,
          children: allRows.map((row) => ({
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: Array.from({ length: tableWidth }, (_, idx) => parseInline(row[idx] ?? '')),
            },
          })),
        },
      });
      continue;
    }

    // 일반 단락
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '') {
      const cur = lines[i];
      if (
        cur.startsWith('#') ||
        cur.startsWith('```') ||
        cur.startsWith('>') ||
        cur.startsWith('|') ||
        /^\s*[-*+]\s+/.test(cur) ||
        /^\s*\d+\.\s+/.test(cur) ||
        /^---+$/.test(cur.trim())
      ) {
        break;
      }
      paraLines.push(cur);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: parseInline(paraLines.join('\n').slice(0, MAX_TEXT_BLOCK_LENGTH)),
        },
      });
    }
  }

  return blocks;
}

// ----- Notion API helpers -----

async function listChildPages(parentId) {
  // dry-run 모드에서 가짜 ID 들어오면 빈 배열 (실제 호출 X)
  if (DRY_RUN && parentId === 'DRY_RUN_PAGE_ID') return [];

  const pages = [];
  let cursor;
  do {
    const res = await withRetry(() =>
      notion.blocks.children.list({
        block_id: parentId,
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    await rateLimit();
    for (const block of res.results) {
      // archived(휴지통) 페이지는 무시 — Notion API가 archived도 list 결과에 포함하지만
      // 그 페이지에 edit/delete 시도하면 "Can't edit block that is archived" 에러.
      // 무시하고 새 페이지 create → 사용자가 archive한 의도 (백업/정리) 존중.
      if (block.type === 'child_page' && !block.archived) {
        pages.push({ id: block.id, title: block.child_page.title });
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// 페이지 내부 콘텐츠 비우기. child_page 블록은 보존 (다른 sub-page 보호용).
async function clearPageContent(pageId, { keepChildPages = false } = {}) {
  let cursor;
  do {
    const res = await withRetry(() =>
      notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    await rateLimit();
    for (const block of res.results) {
      if (keepChildPages && block.type === 'child_page') continue;
      await withRetry(() => notion.blocks.delete({ block_id: block.id }));
      await rateLimit();
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
}

async function getOrCreatePage(parentId, title) {
  const existing = await listChildPages(parentId);
  const found = existing.find((p) => p.title === title);
  if (found) return { id: found.id, created: false };

  if (DRY_RUN) {
    return { id: 'DRY_RUN_PAGE_ID', created: true };
  }
  const res = await withRetry(() =>
    notion.pages.create({
      parent: { page_id: parentId },
      properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
    }),
  );
  await rateLimit();
  return { id: res.id, created: true };
}

async function upsertLeafPage(parentId, title, blocks) {
  const { id: pageId, created } = await getOrCreatePage(parentId, title);

  if (DRY_RUN) {
    console.log(
      `    [dry-run] ${created ? 'create' : 'update'} "${title}" (${blocks.length} blocks)`,
    );
    return pageId;
  }

  if (!created) {
    // 기존 페이지 콘텐츠 비우기 (이 페이지엔 sub-page 없음 → 전부 삭제)
    await clearPageContent(pageId);
  }

  // children 100개씩 batch
  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
    const batch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
    await withRetry(() => notion.blocks.children.append({ block_id: pageId, children: batch }));
    await rateLimit();
  }
  return pageId;
}

// ----- 메인 sync 로직 -----

async function readMarkdown(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const { content } = matter(raw);
  // 첫 H1 제거 (Notion 페이지 제목과 중복 방지)
  return content.replace(/^#\s+.+\n+/, '');
}

async function deriveTitle(filePath, fallback) {
  const raw = await readFile(filePath, 'utf8');
  const { content } = matter(raw);
  const h1 = content.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : basename(fallback, extname(fallback));
}

async function syncFile(parentPageId, filePath, displayTitle) {
  const md = await readMarkdown(filePath);
  const blocks = markdownToBlocks(md);
  console.log(`    📄 ${displayTitle} (${blocks.length} blocks)`);
  await upsertLeafPage(parentPageId, displayTitle, blocks);
}

async function syncFolder(parentPageId, folderName, groupTitle, { onlyFiles } = {}) {
  const folderPath = join(DOCS_ROOT, folderName);
  let files;
  try {
    files = await readdir(folderPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`\n  ⏭  ${folderName}/ 폴더 없음, skip`);
      return;
    }
    throw err;
  }

  let mdFiles = files.filter((f) => f.endsWith('.md')).sort();

  // 증분 모드: onlyFiles에 있는 파일만 처리 (basename 기준).
  if (onlyFiles) {
    const allowed = new Set(onlyFiles);
    mdFiles = mdFiles.filter((f) => allowed.has(f));
    if (mdFiles.length === 0) {
      console.log(`\n  ⏭  ${folderName}/ 변경 파일 없음, skip`);
      return;
    }
  }

  if (mdFiles.length === 0) {
    console.log(`\n  ⏭  ${folderName}/ 마크다운 없음, skip`);
    return;
  }

  console.log(`\n📂 ${groupTitle} (${mdFiles.length} files${onlyFiles ? ', 변경분만' : ''})`);

  // 그룹 페이지 (없으면 create, 있으면 그대로 사용 — child sub-page는 syncFile이 알아서 upsert)
  const { id: groupPageId, created } = await getOrCreatePage(parentPageId, groupTitle);
  console.log(`   group page: ${created ? 'created' : 'reused'} (${groupPageId})`);

  for (const file of mdFiles) {
    const filePath = join(folderPath, file);
    const title = await deriveTitle(filePath, file);
    await syncFile(groupPageId, filePath, title);
  }
}

// ----- entry -----

async function main() {
  const mode = INCREMENTAL ? '증분(변경분만)' : '전체';
  console.log(`🚀 Notion sync 시작 ${DRY_RUN ? '(DRY RUN)' : ''} — ${mode}`);
  console.log(`   parent page: ${NOTION_PARENT_PAGE_ID}`);

  // 증분 모드: 변경 파일 → 폴더별로 group + ROOT 분류
  let rootDocsToSync = ROOT_DOCS;
  const folderOnlyFiles = new Map(); // folder name → Set of basenames

  if (INCREMENTAL) {
    console.log(`   변경 파일 ${CHANGED_FILES.length}개:`);
    for (const p of CHANGED_FILES) console.log(`     - ${p}`);

    const changed = new Set(CHANGED_FILES);

    // 1. ROOT_DOCS 중 변경된 것만
    rootDocsToSync = ROOT_DOCS.filter((doc) => changed.has(`docs/${doc.file}`));

    // 2. FOLDER_GROUPS 중 변경 파일이 속한 폴더 찾기
    for (const group of FOLDER_GROUPS) {
      const prefix = `docs/${group.folder}/`;
      const basenamesInFolder = CHANGED_FILES.filter((p) => p.startsWith(prefix)).map((p) =>
        p.slice(prefix.length),
      );
      if (basenamesInFolder.length > 0) {
        folderOnlyFiles.set(group.folder, new Set(basenamesInFolder));
      }
    }

    // 변경 파일이 모두 sync 대상 밖이면 (templates/, screens/ 등) 즉시 종료
    if (rootDocsToSync.length === 0 && folderOnlyFiles.size === 0) {
      console.log(
        `\n⏭  변경된 파일이 sync 대상이 아님 (templates/, screens/ 또는 등록 안 된 폴더). 종료.`,
      );
      return;
    }
  }

  // 1. root 단일 문서
  for (const doc of rootDocsToSync) {
    const filePath = join(DOCS_ROOT, doc.file);
    console.log(`\n📂 ${doc.title}`);
    await syncFile(NOTION_PARENT_PAGE_ID, filePath, doc.title);
  }

  // 2. 폴더 그룹
  for (const group of FOLDER_GROUPS) {
    if (EXCLUDED_FOLDERS.includes(group.folder)) continue;

    if (INCREMENTAL) {
      const onlyFiles = folderOnlyFiles.get(group.folder);
      if (!onlyFiles) continue; // 이 폴더엔 변경 없음
      await syncFolder(NOTION_PARENT_PAGE_ID, group.folder, group.title, { onlyFiles });
    } else {
      await syncFolder(NOTION_PARENT_PAGE_ID, group.folder, group.title);
    }
  }

  console.log(`\n✅ sync 완료. 총 ${requestCount} Notion API 요청.`);
}

main().catch((err) => {
  console.error('\n❌ sync 실패:', err.message ?? err);
  if (err.code === 'unauthorized') {
    console.error('   → NOTION_TOKEN이 잘못됐거나 만료됐을 가능성');
  } else if (err.code === 'object_not_found') {
    console.error('   → NOTION_PARENT_PAGE_ID가 잘못됐거나 Integration이 페이지에 invite되지 않음');
    console.error('   → Notion 페이지 → ... → 연결 → "Trailog" 추가했는지 확인');
  } else if (err.code === 'rate_limited') {
    console.error('   → Notion API rate limit (3 req/s) 초과. RATE_LIMIT_DELAY_MS 조정 필요');
  } else if (err.code === 'validation_error') {
    console.error('   → Notion API 요청 형식 오류. 마크다운 변환 로직 버그 가능성');
  }
  process.exit(1);
});
