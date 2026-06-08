// ErrorState — 에러 발생 시 공통 안내 + 재시도 버튼 컴포넌트 (Phase 2 4.8 D5).
//
// 사용 사례:
//   - useQuery isError + refetch
//   - mutation 실패 → Alert 외에 화면 단 에러
//
// 디자인 — 토스/당근 패턴: 중앙 정렬 + danger 색 텍스트 + primary 재시도 버튼.

import { Pressable, Text, View } from 'react-native';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = '문제가 발생했어요',
  message,
  onRetry,
  retryLabel = '다시 시도',
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="font-pretendard-semibold text-base text-text-primary dark:text-text-primary-dark mb-2">
        {title}
      </Text>
      {message && (
        <Text className="font-pretendard text-sm text-danger text-center mb-4">{message}</Text>
      )}
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="px-5 py-2.5 bg-primary rounded-md active:opacity-80"
        >
          <Text className="font-pretendard-semibold text-sm text-white">{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
