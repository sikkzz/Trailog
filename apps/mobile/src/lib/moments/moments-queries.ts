// Moments React Query hooks.
//
// 참조 패턴 비교:
// - 회사: `useQuery({ queryKey: ['getMyProjects', status], queryFn: () => service.getMyProjects() })`
// - Trailog: 동일 패턴 + queryKey factory (충돌 방지 + 일관성)
//
// queryKey factory 패턴 (TanStack 권장):
// - `momentsKeys.all` → 전체 invalidate
// - `momentsKeys.list()` → 리스트만 invalidate
// - `momentsKeys.detail(id)` → 특정 Moment만 invalidate

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createMoment, fetchMoments } from './moments-api';
import type { CreateMomentRequest } from './moments-schemas';

export const momentsKeys = {
  all: ['moments'] as const,
  list: () => [...momentsKeys.all, 'list'] as const,
  detail: (id: string) => [...momentsKeys.all, 'detail', id] as const,
};

/** 본인의 Moment 리스트 query. */
export function useMoments() {
  return useQuery({
    queryKey: momentsKeys.list(),
    queryFn: fetchMoments,
  });
}

/**
 * Moment 생성 mutation.
 * 성공 시 momentsKeys.all invalidate → list 자동 refetch.
 */
export function useCreateMoment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMomentRequest) => createMoment(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: momentsKeys.all });
    },
  });
}
