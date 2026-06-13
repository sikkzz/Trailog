// @trailog/eslint-config/next
// Next.js (App Router) 환경용 ESLint config.
// base + React + React Hooks + Next core-web-vitals + Next App Router 룰.
//
// Next 16부터 `next lint` 명령 제거 → ESLint flat config 직접 활용이 표준.

import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // React 17+ 새 JSX transform — 매 파일마다 import React 안 해도 됨
      'react/react-in-jsx-scope': 'off',
      // TypeScript 사용 시 prop-types 불필요
      'react/prop-types': 'off',
      // 함수 컴포넌트 display name은 자동 추론
      'react/display-name': 'warn',
    },
  },
];
