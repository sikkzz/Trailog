// Geocoding API 클라이언트 — Phase 2 4.7 D6.
//
// 좌표 → 한국어 주소 (백엔드 proxy → NCP Reverse Geocoding).
// 이전 expo-location.reverseGeocodeAsync는 OS별 결과 차이가 큼 (iOS Apple /
// Android Google). 백엔드 NCP 통일 + 한국어 보장 + Secret 백엔드 only.

import { apiRequest } from '../auth';

import { ReverseGeocodeResponseSchema, type ReverseGeocodeResponse } from './geocoding-schemas';

/** 좌표 → 한국어 주소 (도로명 우선, 지번 fallback). */
export async function fetchReverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResponse> {
  const data = await apiRequest(`/geocode/reverse?lat=${lat}&lng=${lng}`);
  return ReverseGeocodeResponseSchema.parse(data);
}
