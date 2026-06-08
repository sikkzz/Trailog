// LoadingState — 로딩 spinner 공통 컴포넌트 (Phase 2 4.8 D5).
//
// 사용 사례:
//   - useQuery isLoading
//   - 비동기 데이터 대기
//
// `size`로 작은 (small=20pt) / 큰 (large=36pt) 분기.
// `message`로 부가 텍스트 (예: "사진 처리 중...").

import { ActivityIndicator, Text, View } from 'react-native';

interface LoadingStateProps {
  size?: 'small' | 'large';
  message?: string;
}

export function LoadingState({ size = 'large', message }: LoadingStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <ActivityIndicator size={size} />
      {message && (
        <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mt-3">
          {message}
        </Text>
      )}
    </View>
  );
}
