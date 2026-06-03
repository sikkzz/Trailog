// moments/create — 새 Moment 생성 화면.
//
// 참조 코드 비교 + RN 기본 문법 해설은 login.tsx 헤더 참고.
//
// ⚠️ 임시 UI — UI/UX 폴리시 wave에 정정 예정 (메모리 `ui-ux-polish-wave-revisit`):
//   - 시작/종료 input: raw ISO 8601 string → DatePicker (`@react-native-community/datetimepicker`)
//   - 색상/spacing/typography: design system 정착 시 통일
//   - 전체 화면 시각 디자인 폴리시 wave에서 일괄 (Phase 2 4.7 종료 후 예정)
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
  StyleSheet,
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>새 Moment</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>제목</Text>
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="도쿄 여행, 성수 ABC 카페, 한강 산책 ..."
                  editable={!isSubmitting}
                />
                {errors.title && <Text style={styles.error}>{errors.title.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="startedAt"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>시작 (선택, ISO 8601)</Text>
                <TextInput
                  style={[styles.input, errors.startedAt && styles.inputError]}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-04-15T00:00:00Z"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                {errors.startedAt && <Text style={styles.error}>{errors.startedAt.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="endedAt"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>종료 (선택, ISO 8601)</Text>
                <TextInput
                  style={[styles.input, errors.endedAt && styles.inputError]}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-04-22T00:00:00Z"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                {errors.endedAt && <Text style={styles.error}>{errors.endedAt.message}</Text>}
              </View>
            )}
          />

          <Text style={styles.helper}>단발 방문이면 시작/종료 둘 다 비워도 OK</Text>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? '만드는 중...' : '만들기'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  cancel: { fontSize: 16, color: '#666' },
  content: { flex: 1, padding: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputError: { borderColor: '#e53935' },
  error: { fontSize: 12, color: '#e53935', marginTop: 4 },
  helper: { fontSize: 12, color: '#999', marginBottom: 24 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: { backgroundColor: '#155cb0' },
  buttonDisabled: { backgroundColor: '#9bb8e0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
