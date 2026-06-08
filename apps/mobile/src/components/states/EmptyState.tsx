// EmptyState — 데이터 없을 때 공통 안내 컴포넌트 (Phase 2 4.8 D5).
//
// 사용 사례:
//   - Moments 리스트 0건 — "아직 박제된 순간이 없어요"
//   - 사진 그리드 0건 — "아직 사진이 없어요"
//   - 검색 결과 0건 (Phase 후속)
//
// 디자인 — 토스/당근 패턴: 중앙 정렬 + 큰 제목 + 작은 부제 + 행동 안내.
// children으로 CTA 버튼 등 자유 추가 가능.

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface EmptyStateProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-10">
      <Text className="font-pretendard-medium text-base text-text-secondary dark:text-text-secondary-dark mb-2">
        {title}
      </Text>
      {description && (
        <Text className="font-pretendard text-sm text-text-tertiary dark:text-text-tertiary-dark text-center leading-5">
          {description}
        </Text>
      )}
      {children && <View className="mt-4">{children}</View>}
    </View>
  );
}
