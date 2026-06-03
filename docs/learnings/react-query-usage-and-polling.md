# React Query (TanStack Query) 사용 + Polling 패턴

> **작성일**: 2026-06-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #5 성능 최적화/캐싱 (PROJECT_ROOT 2장)
> **관련 문서**: [Phase 2 Spec 4.6](../specs/phase-02-core-features.md), [API Client 패턴](api-client-patterns.md), [Zod 런타임 검증](zod-runtime-validation-ux.md)

---

## 한 줄 요약

**React Query (TanStack Query)** = 서버 상태 관리 lib. `useQuery`로 fetch + 캐싱 + 자동 refetch, `useMutation`으로 쓰기 작업 + 캐시 invalidate. **글로벌 상태 lib(Zustand/Redux)를 줄이는 핵심** — 데이터가 서버에 있으면 Query로 충분. Trailog는 React Query만 + 글로벌 lib 미도입.

## 우리 프로젝트에서 어디에 쓰이는가

Phase 2 4.6 D3/D4 모바일 데이터 흐름:

| Hook                                | 백엔드 endpoint                         |
| ----------------------------------- | --------------------------------------- |
| `useMoments()`                      | GET /moments                            |
| `useCreateMoment()` mutation        | POST /moments                           |
| `useMomentPhotos(momentId)`         | GET /moments/:id/photos                 |
| `useUploadPhoto(momentId)` mutation | POST upload-url + R2 PUT + POST confirm |

Provider는 `_layout.tsx`에 한 번만:

```tsx
<QueryClientProvider client={queryClient}>
  <Stack ... />
</QueryClientProvider>
```

## 어떻게 동작하는가

### useQuery 기본

```tsx
const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
  queryKey: ['moments', 'list'],
  queryFn: () => apiRequest('/moments').then(GetMomentsResponseSchema.parse),
});
```

- **queryKey** — 캐시 key (배열). 같은 key 호출은 캐시 hit.
- **queryFn** — 데이터 fetch. async function 반환.
- **반환** — `data`, `isLoading`, `isError`, `error`, `refetch` 등 메타.

### queryKey factory 패턴

queryKey를 string literal로 박으면 오타 위험. factory로 관리:

```tsx
export const momentsKeys = {
  all: ['moments'] as const,
  list: () => [...momentsKeys.all, 'list'] as const,
  detail: (id: string) => [...momentsKeys.all, 'detail', id] as const,
};
```

```tsx
// 모든 moments 관련 query invalidate
queryClient.invalidateQueries({ queryKey: momentsKeys.all });
// 리스트만
queryClient.invalidateQueries({ queryKey: momentsKeys.list() });
// 특정 moment detail만
queryClient.invalidateQueries({ queryKey: momentsKeys.detail('abc-123') });
```

### useMutation + invalidate

쓰기 작업 + 성공 시 관련 query invalidate → 자동 refetch.

```tsx
export function useCreateMoment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMomentRequest) => createMoment(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: momentsKeys.all });
    },
  });
}

// 사용
const create = useCreateMoment();
create.mutate(
  { title: '도쿄 여행' },
  {
    onSuccess: () => router.back(),
    onError: (e) => Alert.alert('실패', e.message),
  },
);
```

`isPending`, `error` 등 mutation도 같이 노출.

### 글로벌 옵션 — query-client.ts

```tsx
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30초 동안 stale 안 됨 (refetch 안 함)
      retry: 1, // 실패 시 1회 자동 retry
      refetchOnWindowFocus: false, // 웹 컨셉 — 모바일 무관
      refetchOnReconnect: true, // 네트워크 복원 시 자동 refetch
    },
    mutations: {
      retry: 0, // 쓰기 작업은 retry X (사용자 의도 보존)
    },
  },
});
```

모바일 적합 값 — `staleTime` 30초 (화면 전환 잦음 → 매번 refetch 부담), `refetchOnReconnect` true (모바일 네트워크 불안정).

## 핵심 개념

### Polling — `refetchInterval`

처리 중인 데이터를 주기적으로 fetch. Trailog 사진 처리 흐름:

- 사진 업로드 → `processing_status='pending'`
- BullMQ worker sharp 변환 → `'done'`
- 모바일이 자동으로 `done` detect → overlay 사라짐

```tsx
export function useMomentPhotos(momentId: string) {
  return useQuery({
    queryKey: photosKeys.list(momentId),
    queryFn: () => getMomentPhotos(momentId),
    refetchInterval: (query) => {
      const hasPending = query.state.data?.photos.some((p) => p.processingStatus === 'pending');
      return hasPending ? 3000 : false;
    },
  });
}
```

**핵심**:

- **함수형 `refetchInterval`** — query state 기반 동적 결정
- **`false` 반환** — 폴링 정지 (모두 done이면)
- **3초** — 백엔드 sharp 처리 ~1-2초 + 여유

**대안**:

- **SSE** — 백엔드 push (효율 ↑, 복잡 ↑)
- **WebSocket** — 양방향 (multi-user 흐름)
- polling은 **단순/안정 / 처리 시간 짧음** 케이스 적합.

### isRefetching 함정 — Pull-to-Refresh와 분리

`isRefetching`은 **모든 refetch에 true** (polling, focus, manual). RefreshControl과 직접 binding하면 polling마다 RefreshControl이 떴다 사라짐.

```tsx
// ❌ 깜빡임
<FlatList refreshing={isRefetching} onRefresh={() => refetch()} />;

// ✅ manual state로 분리
const [isManualRefreshing, setIsManualRefreshing] = useState(false);
const handleRefresh = useCallback(async () => {
  setIsManualRefreshing(true);
  try {
    await refetch();
  } finally {
    setIsManualRefreshing(false);
  }
}, [refetch]);

<FlatList refreshing={isManualRefreshing} onRefresh={handleRefresh} />;
```

### Optimistic update (선택)

mutation 성공 전에 캐시 미리 update. UX ↑ 하지만 복잡 ↑.

```tsx
useMutation({
  mutationFn: createMoment,
  onMutate: async (newMoment) => {
    await qc.cancelQueries({ queryKey: momentsKeys.list() });
    const previous = qc.getQueryData(momentsKeys.list());
    qc.setQueryData(momentsKeys.list(), (old) => ({
      moments: [
        { id: 'temp', ...newMoment, createdAt: new Date().toISOString() },
        ...(old?.moments ?? []),
      ],
    }));
    return { previous };
  },
  onError: (_e, _vars, ctx) => {
    qc.setQueryData(momentsKeys.list(), ctx?.previous); // rollback
  },
  onSettled: () => {
    void qc.invalidateQueries({ queryKey: momentsKeys.list() });
  },
});
```

Trailog는 단순 invalidate로 시작 — optimistic은 Phase 후속.

### Suspense 모드 (선택)

`useSuspenseQuery` — React Suspense 통합. `<Suspense fallback={<Spinner />}>` 안에서 사용. 코드 단순 ↑. Trailog는 일반 `useQuery` (분기 명확).

## 왜 React Query인가 — 대안 비교

| Lib                 | 장점                                                | 단점                                   |
| ------------------- | --------------------------------------------------- | -------------------------------------- |
| **TanStack Query**  | 사실상 표준, 풍부한 기능, devtool, framework 비종속 | 학습 곡선 — 옵션 많음                  |
| SWR (Vercel)        | 단순 API, Next 친화                                 | 기능 ↓, 모바일 사례 적음               |
| Apollo Client       | GraphQL 전용                                        | REST 사용 X                            |
| Redux Toolkit Query | Redux 통합                                          | Redux 도입 부담                        |
| Custom hook (자체)  | 의존성 0                                            | 캐싱/retry/invalidate 직접 구현 — 비추 |

→ TanStack Query 채택 (실무 + Trailog 동일).

## 참조 패턴 비교

참조 (Next 14 + axios + react-query 4):

```tsx
const { data } = useQuery({
  queryKey: ['getMyProjects', status],
  queryFn: () => legacyProjectAPIService.getMyProjects(),
  enabled: status === 'authenticated',
});
```

| 항목       | 참조 (Web)                                | Trailog (Mobile)         |
| ---------- | ----------------------------------------- | ------------------------ |
| Lib        | @tanstack/react-query 4                   | 5 (최신)                 |
| API 호출   | class service (`legacyProjectAPIService`) | 함수형 (`fetchMoments`)  |
| queryKey   | string + 의존성                           | factory 패턴 (충돌 회피) |
| invalidate | `qc.invalidateQueries(['key'])`           | `momentsKeys.all`        |
| Polling    | (실무 X — 데이터 거의 정적)               | `refetchInterval` 함수형 |

→ 거의 동일. queryKey factory와 polling은 Trailog 추가 패턴.

## 흔한 함정

1. **queryKey에 변경 가능한 값 X 박음** — `Date.now()` 같은 매번 변하는 값 박으면 캐시 무용지물.
2. **queryKey 오타** — factory 패턴으로 회피.
3. **enabled 안 박음** — 의존 데이터 없을 때 호출되어 에러. `enabled: !!momentId` 같이.
4. **isRefetching을 RefreshControl에 직접 binding** — polling 깜빡임 (위 참고).
5. **invalidate 누락** — mutation 성공 후 query refetch 안 됨 → UI stale.
6. **staleTime 0** — 매 mount마다 refetch → 모바일 데이터/배터리 소모.
7. **mutation retry: 1 (default)** — 중복 POST 위험. `mutations: { retry: 0 }` 설정.
8. **에러 처리 — `error.message` 직접 사용** — Zod/api-client에서 명시적 메시지 추출 패턴.
9. **`onSuccess`에서 useState 호출** — query 캐시 update 패턴 활용 (`setQueryData`).
10. **devtools 부재** — `@tanstack/react-query-devtools` 도입 시 디버깅 편의 (Phase 후속).

## 더 파볼 거리

- **react-query-persist-client** — AsyncStorage 캐시 영구 (앱 재시작 후도 유지)
- **infinite query** — `useInfiniteQuery`로 무한 스크롤 (사진/Moment 많아질 때)
- **prefetch** — `qc.prefetchQuery` — 리스트 진입 직전 detail 미리 fetch
- **dependent queries** — 한 query 결과로 다음 query 호출
- **suspense / errorBoundary** — `<Suspense>` 통합으로 코드 단순화
- **devtools** — 모바일은 RN flipper plugin 또는 별도 panel
- **mutation queue** — 오프라인 상태에 mutation 누적 → 온라인 시 재시도

## 참고 링크

- [TanStack Query 공식](https://tanstack.com/query/latest)
- [queryKey factory pattern (TkDodo blog)](https://tkdodo.eu/blog/effective-react-query-keys)
- [Polling 패턴](https://tanstack.com/query/latest/docs/framework/react/guides/refetching#refetching-interval)
- [Optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
