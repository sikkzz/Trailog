/// <reference types="nativewind/types" />

// global.css side-effect import 허용 (TS2882 회피).
// NativeWind v4가 metro 단에서 처리하지만 tsc는 모듈 declaration 없으면 거부.
declare module '*.css';
