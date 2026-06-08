// Tailwind config — Trailog 디자인 토큰 단일 출처 (Phase 2 4.8 D2).
//
// 테마: Modern Minimal + Earthy Brown (사진 콘텐츠 우선 + 발자취 정체성).
// 다크모드: 시스템 자동 (`media` strategy — useColorScheme + dark: prefix).
// 폰트: Pretendard (D2-2에서 expo-font 등록).

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config 파일 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media', // 시스템 설정 자동 (useColorScheme + dark: prefix)
  theme: {
    extend: {
      colors: {
        // Primary — Earthy Brown (발자취/추억)
        primary: {
          DEFAULT: '#5C4033',
          50: '#FBF7F4',
          100: '#F5EBE3',
          200: '#E4CCB8',
          300: '#C9A085',
          400: '#9A6D52',
          500: '#5C4033',
          600: '#4A3329',
          700: '#3A2820',
          800: '#2A1D17',
          900: '#1A120F',
        },
        // Semantic
        success: '#2E7D32',
        danger: '#D32F2F',
        warning: '#F9A825',
        info: '#1976D2',
        // Surface / Background / Text — 라이트/다크 분기는 화면에서 dark: prefix
        // (이 토큰은 light 기준 — dark는 CSS 변수 또는 dark: 직접)
        background: '#FFFFFF',
        surface: '#F5F5F5',
        border: '#E5E5E5',
        'text-primary': '#1A1A1A',
        'text-secondary': '#666666',
        'text-tertiary': '#999999',
        // Dark mode (dark: prefix에서 활용)
        'background-dark': '#0A0A0A',
        'surface-dark': '#1A1A1A',
        'border-dark': '#2A2A2A',
        'text-primary-dark': '#F5F5F5',
        'text-secondary-dark': '#A3A3A3',
        'text-tertiary-dark': '#737373',
      },
      fontFamily: {
        // Pretendard — D2-2에서 expo-font로 로드 + 폰트 weight별 family
        pretendard: ['Pretendard'],
        'pretendard-medium': ['Pretendard-Medium'],
        'pretendard-semibold': ['Pretendard-SemiBold'],
        'pretendard-bold': ['Pretendard-Bold'],
      },
      fontSize: {
        // Trailog typography scale — 한국어 가독성 고려
        '2xs': '11px',
        xs: '12px',
        sm: '13px',
        base: '15px', // 본문 (한국 표준 — 영문 14 → 한국 15가 자연)
        lg: '17px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '28px',
        '4xl': '32px',
        '5xl': '40px',
      },
      spacing: {
        // 8pt grid + 4단위 보조 — Apple HIG + Material 공통
        // 0 / 1 / 2 / 3 / 4 / 5 / 6 / 8 / 10 / 12 / 16 / 20 / 24 / 32 ...
        // Tailwind default가 이미 4pt grid (1=4px)라 그대로 활용
      },
      borderRadius: {
        // 토스/당근 표준 — small 8, medium 12, large 16, pill 9999
        none: '0',
        sm: '6px',
        DEFAULT: '12px', // 기본 (버튼/카드)
        md: '12px',
        lg: '16px', // 큰 카드
        xl: '20px',
        '2xl': '24px',
        full: '9999px', // pill
      },
    },
  },
  plugins: [],
};
