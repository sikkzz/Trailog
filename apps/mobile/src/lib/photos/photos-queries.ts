// Photos React Query hooks.
//
// 참조 패턴 일관 — queryKey factory + invalidate on mutation success.
//
// queryKey 구조:
//   - photosKeys.all                → 모든 photos query (전역 invalidate)
//   - photosKeys.list(momentId)     → 특정 moment의 사진 리스트
//   - photosKeys.map(bbox)          → 지도 viewport 사진 (Phase 2 4.7 D3b)
//
// useUploadPhoto:
//   - mutationFn: uploadPhoto(momentId, blob, ext)
//   - onSuccess: 해당 moment의 photos query invalidate → 즉시 refetch

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMapPhotos, getMomentPhotos, uploadPhoto } from './photos-api';
import type { AllowedPhotoExt, Bbox } from './photos-schemas';

export const photosKeys = {
  all: ['photos'] as const,
  list: (momentId: string) => [...photosKeys.all, 'list', momentId] as const,
  map: (bbox: Bbox) => [...photosKeys.all, 'map', ...bbox] as const,
};

/**
 * Moment의 사진 리스트 query.
 *
 * **자동 polling** — 사진 중 processingStatus='pending'이 하나라도 있으면 3초마다 refetch.
 * 모두 'done'/'failed'면 polling 정지 (`refetchInterval: false`).
 *
 * 패턴: TanStack Query `refetchInterval`에 함수 전달 — query.state.data 기준 동적 결정.
 * 학습 포인트 — Polling 대안:
 *   - SSE/WebSocket (Phase 후속) — 백엔드 push, 더 효율
 *   - polling은 단순/안정 — 처리 시간 짧을 때(~수초) 적합
 */
export function useMomentPhotos(momentId: string) {
  return useQuery({
    queryKey: photosKeys.list(momentId),
    queryFn: () => getMomentPhotos(momentId),
    enabled: Boolean(momentId),
    refetchInterval: (query) => {
      const hasPending = query.state.data?.photos.some((p) => p.processingStatus === 'pending');
      return hasPending ? 3000 : false;
    },
  });
}

/**
 * 지도 viewport 안 본인 사진 query (Phase 2 4.7 D3b).
 *
 * - bbox null 또는 enabled=false면 호출 X (Map 탭 mount 직후 첫 camera 이벤트 전)
 * - bbox 변경 → queryKey 변경 → 자동 재호출 (React Query 표준 흐름)
 * - **placeholderData: keepPreviousData** — viewport 이동 중 이전 pin 유지 (flicker 방지)
 * - polling 없음 — bbox 변경 외엔 stale 검토 X (moments 화면처럼 pending 폴링 불필요)
 *
 * 사용 (D3c):
 *   const { data } = useMapPhotos(bbox);
 *   data?.photos.forEach(p => <Marker ... />);
 */
export function useMapPhotos(bbox: Bbox | null) {
  return useQuery({
    queryKey: bbox ? photosKeys.map(bbox) : [...photosKeys.all, 'map', 'idle'],
    queryFn: () => {
      // enabled 가드 + non-null 보장 (TS narrowing)
      if (!bbox) throw new Error('bbox required');
      return fetchMapPhotos(bbox);
    },
    enabled: bbox !== null,
    placeholderData: keepPreviousData,
  });
}

/**
 * 사진 업로드 mutation.
 * 성공 시 해당 moment의 photos query invalidate → 리스트 자동 refetch.
 *
 * 사용:
 *   const upload = useUploadPhoto(momentId);
 *   upload.mutate({ fileUri: asset.uri, ext: 'jpg' });
 */
export function useUploadPhoto(momentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileUri, ext }: { fileUri: string; ext: AllowedPhotoExt }) =>
      uploadPhoto(momentId, fileUri, ext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: photosKeys.list(momentId) });
    },
  });
}
