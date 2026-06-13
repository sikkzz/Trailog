// Trailog Web Tailwind 설정 — ADR-0011 디자인 토큰을 모바일과 mirror.
//
// 모바일 (apps/mobile/tailwind.config.js)의 colors / fontFamily / fontSize / borderRadius와
// 1:1 동일. 단일 출처 추출(packages/shared/design-tokens)은 Phase 후속 검토.

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Earthy Brown primary — 발자취 정체성
        primary: {
          DEFAULT: '#5C4033',
          50: '#F5EFEC',
          100: '#E8DAD2',
          200: '#D4B8A8',
          300: '#BF967D',
          400: '#A57754',
          500: '#8A5F3F',
          600: '#5C4033',
          700: '#4A3329',
          800: '#382620',
          900: '#251914',
        },
        background: { DEFAULT: '#FAFAFA', dark: '#0A0A0A' },
        surface: { DEFAULT: '#FFFFFF', dark: '#171717' },
        border: { DEFAULT: '#E5E5E5', dark: '#2A2A2A' },
        'text-primary': { DEFAULT: '#171717', dark: '#FAFAFA' },
        'text-secondary': { DEFAULT: '#525252', dark: '#A3A3A3' },
        'text-tertiary': { DEFAULT: '#999999', dark: '#737373' },
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#F59E0B',
        info: '#0EA5E9',
      },
      fontFamily: {
        pretendard: ['Pretendard', 'sans-serif'],
        'pretendard-medium': ['Pretendard-Medium', 'sans-serif'],
        'pretendard-semibold': ['Pretendard-SemiBold', 'sans-serif'],
        'pretendard-bold': ['Pretendard-Bold', 'sans-serif'],
      },
      fontSize: {
        '2xs': '10px',
        xs: '12px',
        sm: '13px',
        base: '15px',
        lg: '17px',
        xl: '19px',
        '2xl': '24px',
        '3xl': '28px',
        '4xl': '32px',
        '5xl': '40px',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '12px',
        lg: '16px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
