// Geocoding React Query hook — Phase 2 4.7 D6.
//
// queryKey 구조:
//   - geocodingKeys.all                    → 전체 (전역 invalidate)
//   - geocodingKeys.reverse(lat, lng)      → 특정 좌표
//
// staleTime ↑ — 좌표는 변하지 않음 (주소는 영구 불변에 가까움). 캐시 적극 활용.

import { useQuery } from '@tanstack/react-query';

import { fetchReverseGeocode } from './geocoding-api';

export const geocodingKeys = {
  all: ['geocoding'] as const,
  reverse: (lat: number, lng: number) => [...geocodingKeys.all, 'reverse', lat, lng] as const,
};

/**
 * 좌표 → 한국어 주소 query.
 *
 * - location null이면 enabled=false (호출 X)
 * - staleTime: Infinity — 좌표 주소는 변하지 X, 한 번 받으면 재호출 불필요
 * - gcTime: 24h — 메모리 효율 (앱 라이프사이클 동안 유지)
 */
export function useReverseGeocode(location: { latitude: number; longitude: number } | null) {
  return useQuery({
    queryKey: location
      ? geocodingKeys.reverse(location.latitude, location.longitude)
      : geocodingKeys.all,
    queryFn: () => {
      if (!location) throw new Error('location required');
      return fetchReverseGeocode(location.latitude, location.longitude);
    },
    enabled: location !== null,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
