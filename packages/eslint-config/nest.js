// @trailog/eslint-config/nest
// NestJS / Node.js 환경용 ESLint config. base에 Node globals + Nest 특화 룰을 추가.

import globals from 'globals';
import base from './base.js';

export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // NestJS는 데코레이터 메타데이터 기반이라 빈 함수/인터페이스가 흔함 → 경고로 완화
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
];
