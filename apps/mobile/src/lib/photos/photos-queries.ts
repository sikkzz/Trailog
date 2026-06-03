// Photos React Query hooks.
//
// 참조 패턴 일관 — queryKey factory + invalidate on mutation success.
//
// queryKey 구조:
//   - photosKeys.all          → 모든 photos query (전역 invalidate)
//   - photosKeys.list(momentId) → 특정 moment의 사진 리스트
//
// useUploadPhoto:
//   - mutationFn: uploadPhoto(momentId, blob, ext)
//   - onSuccess: 해당 moment의 photos query invalidate → 즉시 refetch

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMomentPhotos, uploadPhoto } from './photos-api';
import type { AllowedPhotoExt } from './photos-schemas';

export const photosKeys = {
  all: ['photos'] as const,
  list: (momentId: string) => [...photosKeys.all, 'list', momentId] as const,
};

/** Moment의 사진 리스트 query. */
export function useMomentPhotos(momentId: string) {
  return useQuery({
    queryKey: photosKeys.list(momentId),
    queryFn: () => getMomentPhotos(momentId),
    enabled: Boolean(momentId),
  });
}

/**
 * 사진 업로드 mutation.
 * 성공 시 해당 moment의 photos query invalidate → 리스트 자동 refetch.
 *
 * 사용:
 *   const upload = useUploadPhoto(momentId);
 *   upload.mutate({ blob, ext: 'jpg' });
 */
export function useUploadPhoto(momentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blob, ext }: { blob: Blob; ext: AllowedPhotoExt }) =>
      uploadPhoto(momentId, blob, ext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: photosKeys.list(momentId) });
    },
  });
}
