// apps/web ESLint flat config
// 공통 next 프리셋만 사용. web 특화 룰이 생기면 아래 객체에 추가.

import next from '@trailog/eslint-config/next';

export default [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
];
