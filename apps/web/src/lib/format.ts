// Web 공통 format util — 사용자 친화 표시.

import type { ExifStripPolicy } from './schemas';

/**
 * ISO → 'YYYY-MM-DD HH:MM'
 * 단순 string slice — Date 객체 변환 X (hydration mismatch 회피).
 */
export function formatDateTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/** ISO → 'YYYY-MM-DD' */
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 만료 D-day 친화 표시.
 * - 1일 이상: "3일 후 만료"
 * - 1시간~1일: "5시간 후 만료"
 * - 1분~1시간: "23분 후 만료"
 * - 만료: "만료됨"
 *
 * **주의**: Date.now() 의존 → Client Component에서만 호출 (SSR hydration mismatch 회피).
 */
export function formatRemainingTime(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return '만료됨';

  const mins = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}일 후 만료`;
  if (hours >= 1) return `${hours}시간 후 만료`;
  return `${mins}분 후 만료`;
}

/**
 * 한국 좌표 범위 check (대략).
 * 한국 본토 + 제주 + 부속 도서 — 33°N ~ 39°N / 124°E ~ 132°E.
 *
 * 본인 의도 (2026-06-13): NCP Reverse Geocoding은 한국 데이터만.
 * 글로벌 좌표는 표시 X (좌표만 보면 어디인지 모름 — 정직한 UX).
 */
export function isInKoreaBounds(latitude: number, longitude: number): boolean {
  return latitude >= 33 && latitude <= 39 && longitude >= 124 && longitude <= 132;
}

/** EXIF strip 정책 → 사용자 안내 텍스트 */
export function formatExifPolicy(policy: ExifStripPolicy): string {
  switch (policy) {
    case 'all':
      return '메타데이터 모두 제거됨';
    case 'gps_only':
      return '위치 정보 제거됨';
    case 'none':
      return '원본 그대로';
    default:
      return '';
  }
}

// downloadPhoto 함수 폐기 (Phase 3 5.2 D5) — 백엔드 proxy URL로 직접 `<a href download>`
// 클릭이 단순/정직. R2 cross-origin GET 403 회피 + 참조 admin-data-center 패턴 일관.
// 자세한 흐름은 DownloadButton 컴포넌트 헤더 주석 참고.
