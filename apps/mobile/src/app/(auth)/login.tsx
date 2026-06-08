// (auth)/login — 로그인 화면.
//
// RHF + zodResolver + RN 컴포넌트 패턴 (ADR-0008 적용).
// Phase 2 4.8 D3-1 — StyleSheet → NativeWind className 마이그레이션 (ADR-0011)
// + Pretendard 폰트 + 다크모드 prefix.
//
// =============================================================================
// 1. 참조 (Next.js Web) ↔ Trailog (RN) 차이 — D2-1 NativeWind 적용 후
// =============================================================================
//
// | 항목      | 참조                                       | Trailog (RN + NativeWind)                  |
// | --------- | ------------------------------------------ | ------------------------------------------ |
// | Form UI   | shadcn `<Form><FormField>` Radix wrapper   | RHF `Controller` 직접 (shadcn X)           |
// | Input     | shadcn `<MainInput>` (Tailwind)            | RN `<TextInput>` + Tailwind className      |
// | Button    | `<MainButton>` (Tailwind hover/active)     | RN `<Pressable>` (pressed state)           |
// | Text      | `<h2>` / `<p>` (HTML)                      | RN `<Text>` (모든 텍스트 강제)             |
// | 클릭      | `onClick`                                  | `onPress`                                  |
// | 스타일    | Tailwind class                             | **NativeWind className** (Tailwind 동일)   |
// | 다크모드  | `dark:` prefix (CSS media)                 | **`dark:` prefix** (useColorScheme 자동)   |
// | 폰트      | OS 시스템 폰트                             | **font-pretendard** (Pretendard preload)   |
// | 에러 표시 | shadcn `<FormMessage>`                     | `<Text>`로 직접 렌더                       |
//
// → NativeWind 도입 후 참조 Tailwind 코드와 className 거의 동일. 차이는 컴포넌트 이름만.
//
// =============================================================================
// 2. 응답 검증
// =============================================================================
//
// apiRequest unwrap → SignInResponseSchema.parse(data) → ZodError 시 throw (ADR-0008).

import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
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

import {
  apiRequest,
  ApiError,
  authStorage,
  SignInRequestSchema,
  SignInResponseSchema,
  type SignInRequest,
} from '../../lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInRequest>({
    resolver: zodResolver(SignInRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (form: SignInRequest) => {
    try {
      // public endpoint — authenticated: false (Bearer 헤더 X)
      const data = await apiRequest('/auth/sign-in', {
        method: 'POST',
        body: form,
        authenticated: false,
      });
      // ADR-0008 — 런타임 응답 검증. 백엔드 schema 변경 시 즉시 ZodError throw.
      const tokens = SignInResponseSchema.parse(data);
      await authStorage.setTokens(tokens);
      // 인증 후 메인 탭으로 (replace — 뒤로 가기 시 로그인 화면 X)
      router.replace('/(tabs)/moments' as never);
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : '로그인 중 오류가 발생했습니다';
      Alert.alert('로그인 실패', message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-6 justify-center">
          <Text className="font-pretendard-bold text-4xl text-text-primary dark:text-text-primary-dark mb-1">
            로그인
          </Text>
          <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-8">
            이메일 + 비밀번호로 들어가기
          </Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  이메일
                </Text>
                <TextInput
                  className={`font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border rounded-md px-3.5 py-3 ${
                    errors.email ? 'border-danger' : 'border-border dark:border-border-dark'
                  }`}
                  placeholderTextColor="#999"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="user@trailog.app"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  editable={!isSubmitting}
                />
                {errors.email && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.email.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <View className="mb-5">
                <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-1.5">
                  비밀번호
                </Text>
                <TextInput
                  className={`font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border rounded-md px-3.5 py-3 ${
                    errors.password ? 'border-danger' : 'border-border dark:border-border-dark'
                  }`}
                  placeholderTextColor="#999"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="8자 이상"
                  secureTextEntry
                  autoComplete="password"
                  editable={!isSubmitting}
                />
                {errors.password && (
                  <Text className="font-pretendard text-xs text-danger mt-1">
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Pressable
            className={`bg-primary rounded-md py-3.5 items-center mt-3 active:opacity-80 ${
              isSubmitting ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text className="font-pretendard-semibold text-base text-white">
              {isSubmitting ? '로그인 중...' : '로그인'}
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-6 gap-1.5">
            <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark">
              처음이세요?
            </Text>
            <Link href={'/(auth)/signup' as never}>
              <Text className="font-pretendard-semibold text-sm text-primary">회원가입</Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
