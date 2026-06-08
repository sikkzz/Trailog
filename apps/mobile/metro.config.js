// Trailog Metro 설정 — pnpm 모노레포 + NativeWind v4 (Phase 2 4.8 D2-1).
//
// 참고:
// - Monorepo: https://docs.expo.dev/guides/monorepos/
// - NativeWind: https://www.nativewind.dev/docs/getting-started/installation

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config 파일 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) 모노레포 루트까지 watch — 워크스페이스 패키지 변경 즉시 반영
config.watchFolders = [workspaceRoot];

// 2) 패키지 해석 순서: 로컬 → 루트
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3) hierarchical lookup 허용
// - .npmrc 의 `node-linker=hoisted` 와 짝. hoisted 모드에선 transitive deps가
//   루트 node_modules에 평평하게 있어서 표준 lookup 필요.
// - pnpm 기본 strict 모드와 Expo의 transitive import 패턴이 충돌하던 이슈 회피.
config.resolver.disableHierarchicalLookup = false;

// NativeWind v4 — Tailwind CSS을 Metro 빌드에 통합 (global.css → atomic styles)
module.exports = withNativeWind(config, { input: './global.css' });
