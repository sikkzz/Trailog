// @trailog/eslint-config — base
// 공통 ESLint flat config. 모든 워크스페이스가 직접 또는 환경별 확장(nest/expo)을 통해 상속.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  // 1) JS 추천 룰
  js.configs.recommended,

  // 2) TypeScript 추천 룰 (typescript-eslint v8: configs.recommended는 배열)
  ...tseslint.configs.recommended,

  // 3) 프로젝트 공통 룰
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // 미사용 변수: _ 접두어는 의도된 무시로 허용
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // any 금지 (CLAUDE.md TS strict 가이드와 일치)
      '@typescript-eslint/no-explicit-any': 'error',
      // console.log는 경고만 (logger 사용 권장하나 학습 단계라 완전 금지하진 않음)
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // 4) 무시할 경로
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/.turbo/**', '**/.next/**'],
  },

  // 5) Prettier 충돌 룰 끄기 — 반드시 마지막!
  prettier,
];
