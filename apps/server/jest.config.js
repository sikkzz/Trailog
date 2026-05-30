// Jest 설정 — NestJS 백엔드 단위 테스트.
//
// - preset ts-jest: TypeScript 직접 실행 (별도 build 단계 X).
// - rootDir src: 소스 옆 *.spec.ts 패턴 자동 감지.
// - moduleFileExtensions: NestJS 표준 (ts/js/json).
// - testEnvironment node: 백엔드는 jsdom 불필요.
//
// 학습 포인트:
// - 단위 테스트는 소스 옆 *.spec.ts (NestJS CLI 컨벤션)
// - 통합 테스트(e2e)는 별도 test/ 디렉토리 — Phase 후속 도입 시 jest-e2e.json 별도 설정
// - coverage 디렉토리는 git ignore (이미 .gitignore에 coverage/ 포함)

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: '../coverage',
};
