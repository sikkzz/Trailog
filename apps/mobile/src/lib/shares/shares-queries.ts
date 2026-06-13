// Shares React Query hooks.
//
// 패턴 (Moments 일관):
// - queryKey factory — sharesKeys.all / list / detail(id)
// - useMyShares — 본인 활성 공유 목록 query
// - useCreateShare — 생성 mutation + sharesKeys.all invalidate
// - useDeleteShare — 취소 mutation + sharesKeys.all invalidate

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createShare, deleteShare, fetchMyShares } from './shares-api';
import type { CreateShareRequest } from './shares-schemas';

export const sharesKeys = {
  all: ['shares'] as const,
  list: () => [...sharesKeys.all, 'list'] as const,
  detail: (id: string) => [...sharesKeys.all, 'detail', id] as const,
};

/** 본인 활성 공유 목록 (5.4 폴리시에서 별도 화면에 활용). */
export function useMyShares() {
  return useQuery({
    queryKey: sharesKeys.list(),
    queryFn: fetchMyShares,
  });
}

/**
 * 공유 링크 생성 mutation.
 * 성공 시 sharesKeys.all invalidate → 본인 목록 자동 refetch.
 */
export function useCreateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateShareRequest) => createShare(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sharesKeys.all });
    },
  });
}

/**
 * 공유 취소 mutation.
 * 성공 시 sharesKeys.all invalidate → 본인 목록 자동 refetch.
 */
export function useDeleteShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => deleteShare(shareId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sharesKeys.all });
    },
  });
}
