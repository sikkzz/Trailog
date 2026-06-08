// moments/create — 새 Moment 생성 화면.
//
// 참조 코드 비교 + RN 기본 문법 해설은 login.tsx 헤더 참고.
// Phase 2 4.8 D3-4 — StyleSheet → NativeWind 마이그레이션 (ADR-0011).
// Phase 2 4.8 D4 — raw ISO 8601 input → react-native-modal-datetime-picker
//   - iOS/Android 동일 modal UX (native picker wrapper, 사용자 친화).
//   - **date만** 선택 (시간 X) — Moment 단위는 date가 자연. 시간은 EXIF로 박힘.
//   - 둘 다 optional 유지 — 단발 방문이면 비워도 OK.
//   - ISO 8601 변환: Date → `YYYY-MM-DDT00:00:00.000Z` (백엔드 zod datetime 검증 통과).
//
// 이 화면 학습 포인트 — react-query mutation 흐름:
//   1. mutation.mutate(body) 호출
//   2. mutationFn 실행 → 백엔드 호출
//   3. onSuccess → invalidateQueries → 리스트 query 자동 refetch
//   4. 모바일 리스트 화면 진입 시 새 Moment 즉시 노출

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../lib/auth';
import {
  CreateMomentRequestSchema,
  useCreateMoment,
  type CreateMomentRequest,
} from '../../lib/moments';

/** Date → ISO 8601 datetime (00:00 UTC) — 백엔드 zod ISO datetime 검증 통과 */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

/** ISO 8601 → 사용자 친화 'YYYY-MM-DD' (한국식 표시) */
function formatDate(iso: string | undefined): string {
  if (!iso) return '선택 안 함';
  return iso.slice(0, 10);
}

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

  // DatePicker modal 가시성 — 시작/종료 중 어떤 거 띄울지 state로 분기
  const [pickerOpen, setPickerOpen] = useState<'started' | 'ended' | null>(null);

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
            render={({ field: { value, onChange } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  시작 (선택)
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setPickerOpen('started')}
                    disabled={isSubmitting}
                    className={`flex-1 bg-surface dark:bg-surface-dark border rounded-md px-3.5 py-3 active:opacity-70 ${
                      errors.startedAt ? 'border-danger' : 'border-border dark:border-border-dark'
                    }`}
                  >
                    <Text
                      className={`font-pretendard text-base ${
                        value
                          ? 'text-text-primary dark:text-text-primary-dark'
                          : 'text-text-tertiary dark:text-text-tertiary-dark'
                      }`}
                    >
                      {formatDate(value)}
                    </Text>
                  </Pressable>
                  {value && (
                    <Pressable
                      onPress={() => onChange(undefined)}
                      disabled={isSubmitting}
                      className="px-3.5 py-3 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md active:opacity-70"
                    >
                      <Text className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark">
                        지우기
                      </Text>
                    </Pressable>
                  )}
                </View>
                {errors.startedAt && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.startedAt.message}
                  </Text>
                )}
                <DateTimePickerModal
                  isVisible={pickerOpen === 'started'}
                  mode="date"
                  date={value ? new Date(value) : new Date()}
                  onConfirm={(d) => {
                    onChange(toIsoDate(d));
                    setPickerOpen(null);
                  }}
                  onCancel={() => setPickerOpen(null)}
                  locale="ko-KR"
                  confirmTextIOS="선택"
                  cancelTextIOS="취소"
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="endedAt"
            render={({ field: { value, onChange } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  종료 (선택)
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setPickerOpen('ended')}
                    disabled={isSubmitting}
                    className={`flex-1 bg-surface dark:bg-surface-dark border rounded-md px-3.5 py-3 active:opacity-70 ${
                      errors.endedAt ? 'border-danger' : 'border-border dark:border-border-dark'
                    }`}
                  >
                    <Text
                      className={`font-pretendard text-base ${
                        value
                          ? 'text-text-primary dark:text-text-primary-dark'
                          : 'text-text-tertiary dark:text-text-tertiary-dark'
                      }`}
                    >
                      {formatDate(value)}
                    </Text>
                  </Pressable>
                  {value && (
                    <Pressable
                      onPress={() => onChange(undefined)}
                      disabled={isSubmitting}
                      className="px-3.5 py-3 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md active:opacity-70"
                    >
                      <Text className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark">
                        지우기
                      </Text>
                    </Pressable>
                  )}
                </View>
                {errors.endedAt && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.endedAt.message}
                  </Text>
                )}
                <DateTimePickerModal
                  isVisible={pickerOpen === 'ended'}
                  mode="date"
                  date={value ? new Date(value) : new Date()}
                  onConfirm={(d) => {
                    onChange(toIsoDate(d));
                    setPickerOpen(null);
                  }}
                  onCancel={() => setPickerOpen(null)}
                  locale="ko-KR"
                  confirmTextIOS="선택"
                  cancelTextIOS="취소"
                />
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
