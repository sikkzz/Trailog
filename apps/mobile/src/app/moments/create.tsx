// moments/create — 새 Moment 생성 화면.
//
// 참조 코드 비교 + RN 기본 문법 해설은 login.tsx 헤더 참고.
// Phase 2 4.8 D3-4 — StyleSheet → NativeWind 마이그레이션 (ADR-0011).
//
// ⚠️ 임시 UI — UI/UX 폴리시 wave 후속 정정:
//   - 시작/종료 input: raw ISO 8601 string → DatePicker (`@react-native-community/datetimepicker`)
//     (D4 별도 단계 예정)
//
// 이 화면 학습 포인트 — react-query mutation 흐름:
//   1. mutation.mutate(body) 호출
//   2. mutationFn 실행 → 백엔드 호출
//   3. onSuccess → invalidateQueries → 리스트 query 자동 refetch
//   4. 모바일 리스트 화면 진입 시 새 Moment 즉시 노출

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../lib/auth';
import {
  CreateMomentRequestSchema,
  useCreateMoment,
  type CreateMomentRequest,
} from '../../lib/moments';

export default function CreateMomentScreen() {
  const router = useRouter();
  const createMutation = useCreateMoment();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateMomentRequest>({
    resolver: zodResolver(CreateMomentRequestSchema),
    defaultValues: { title: '', startedAt: undefined, endedAt: undefined },
  });

  const onSubmit = (form: CreateMomentRequest) => {
    // 빈 string → undefined (zod optional + ISO 검증 회피)
    const body: CreateMomentRequest = {
      title: form.title,
      ...(form.startedAt ? { startedAt: form.startedAt } : {}),
      ...(form.endedAt ? { endedAt: form.endedAt } : {}),
    };
    createMutation.mutate(body, {
      onSuccess: () => router.back(),
      onError: (e) => {
        const message =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Moment 생성 실패';
        Alert.alert('Moment 생성 실패', message);
      },
    });
  };

  const isSubmitting = createMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row justify-between items-center px-5 py-3 border-b border-border dark:border-border-dark">
          <Pressable onPress={() => router.back()}>
            <Text className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark">
              취소
            </Text>
          </Pressable>
          <Text className="font-pretendard-semibold text-base text-text-primary dark:text-text-primary-dark">
            새 Moment
          </Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 p-6">
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  제목
                </Text>
                <TextInput
                  className={`font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border rounded-md px-3.5 py-3 ${
                    errors.title ? 'border-danger' : 'border-border dark:border-border-dark'
                  }`}
                  placeholderTextColor="#999"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="도쿄 여행, 성수 ABC 카페, 한강 산책 ..."
                  editable={!isSubmitting}
                />
                {errors.title && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.title.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="startedAt"
            render={({ field: { value, onChange, onBlur } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  시작 (선택, ISO 8601)
                </Text>
                <TextInput
                  className={`font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border rounded-md px-3.5 py-3 ${
                    errors.startedAt ? 'border-danger' : 'border-border dark:border-border-dark'
                  }`}
                  placeholderTextColor="#999"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-04-15T00:00:00Z"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                {errors.startedAt && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.startedAt.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="endedAt"
            render={({ field: { value, onChange, onBlur } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  종료 (선택, ISO 8601)
                </Text>
                <TextInput
                  className={`font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border rounded-md px-3.5 py-3 ${
                    errors.endedAt ? 'border-danger' : 'border-border dark:border-border-dark'
                  }`}
                  placeholderTextColor="#999"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-04-22T00:00:00Z"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                {errors.endedAt && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.endedAt.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Text className="font-pretendard text-xs text-text-tertiary dark:text-text-tertiary-dark mb-6">
            단발 방문이면 시작/종료 둘 다 비워도 OK
          </Text>

          <Pressable
            className={`bg-primary rounded-md py-3.5 items-center active:opacity-80 ${
              isSubmitting ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text className="font-pretendard-semibold text-base text-white">
              {isSubmitting ? '만드는 중...' : '만들기'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
