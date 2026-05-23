// @trailog/eslint-config/expo
// React Native / Expo 환경용 ESLint config. base에 React + Hooks 룰 + RN globals 추가.

import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // React Native 런타임 글로벌
        __DEV__: 'readonly',
        global: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // React 17+ 새 JSX transform: 매 파일마다 import React 안 해도 됨
      'react/react-in-jsx-scope': 'off',
      // TypeScript 사용 시 prop-types 불필요
      'react/prop-types': 'off',
      // 디스플레이 이름은 함수 컴포넌트엔 자동 추론되니 완화
      'react/display-name': 'warn',
    },
  },
];
