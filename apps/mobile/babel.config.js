// Trailog Babel — NativeWind v4 통합 (Phase 2 4.8 D2-1).
// - `jsxImportSource: 'nativewind'` — JSX runtime이 nativewind/jsx로 컴파일 → className prop 인식
// - `nativewind/babel` preset — Tailwind class를 atomic style로 변환

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
