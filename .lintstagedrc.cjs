// lint-staged 룰 — 모노레포 + ESLint v9 flat config 호환용.
//
// 문제: ESLint v9는 현재 cwd에서만 flat config 찾음 (v8과 달리 파일 트리 거슬러 안 감).
//   lint-staged가 root에서 호출 → apps/server/eslint.config.mjs 못 찾음.
//
// 해결: 각 워크스페이스의 staged 파일을 그 워크스페이스 cwd에서 ESLint 호출.
//   `pnpm --filter <pkg> exec eslint --fix <relative-paths>` 패턴.
//   prettier는 cwd 무관 → root에서 그대로.

const path = require('node:path');

const ROOT = __dirname;

/** workspace 경로 기준으로 staged 파일 상대 경로로 변환 */
function relative(workspace, files) {
  const wsAbs = path.join(ROOT, workspace);
  return files.map((f) => path.relative(wsAbs, f)).join(' ');
}

module.exports = {
  // 각 워크스페이스의 ts/js — 해당 워크스페이스 cwd에서 ESLint + 루트 cwd에서 prettier
  'apps/server/**/*.{ts,tsx,js,jsx,mjs,cjs}': (files) => [
    `pnpm --filter @trailog/server exec eslint --fix ${relative('apps/server', files)}`,
    `prettier --write ${files.map((f) => `'${f}'`).join(' ')}`,
  ],
  'apps/mobile/**/*.{ts,tsx,js,jsx,mjs,cjs}': (files) => [
    `pnpm --filter @trailog/mobile exec eslint --fix ${relative('apps/mobile', files)}`,
    `prettier --write ${files.map((f) => `'${f}'`).join(' ')}`,
  ],
  'packages/eslint-config/**/*.{ts,tsx,js,jsx,mjs,cjs}': (files) => [
    `prettier --write ${files.map((f) => `'${f}'`).join(' ')}`,
  ],

  // 그 외 (json, md, yaml 등 + root level js) — prettier만
  '*.{json,md,yaml,yml,js,mjs,cjs}': ['prettier --write'],
  'docs/**/*.{md,yaml,yml}': ['prettier --write'],
  '.github/**/*.{yml,yaml}': ['prettier --write'],
  'scripts/**/*.{js,mjs,cjs}': ['prettier --write'],
};
