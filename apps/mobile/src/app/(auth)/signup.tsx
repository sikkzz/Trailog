// (auth)/signup — 회원가입 화면.
//
// Login과 동일 패턴 (RHF + zodResolver + RN Controller + NativeWind) — endpoint만 /auth/sign-up.
// 참조 코드 비교 / RN 기본 문법 해설은 login.tsx 헤더 주석 참고 (중복 박제 회피).
//
// SignUpRequestSchema는 SignInRequestSchema와 거의 동일하지만 password에 max(72) 추가
// (bcrypt 입력 한계 — 백엔드 검증과 일치).
//
// Phase 2 4.8 D3-1 — StyleSheet → NativeWind 마이그레이션 (ADR-0011).

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
  SignUpRequestSchema,
  SignUpResponseSchema,
  type SignUpRequest,
} from '../../lib/auth';

export default function SignupScreen() {
  const router = useRouter();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpRequest>({
    resolver: zodResolver(SignUpRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (form: SignUpRequest) => {
    try {
      const data = await apiRequest('/auth/sign-up', {
        method: 'POST',
        body: form,
        authenticated: false,
      });
      const tokens = SignUpResponseSchema.parse(data);
      await authStorage.setTokens(tokens);
      router.replace('/(tabs)/moments' as never);
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : '회원가입 중 오류가 발생했습니다';
      Alert.alert('회원가입 실패', message);
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
            회원가입
          </Text>
          <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-8">
            이메일 + 비밀번호 (8자 이상)
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
                  placeholder="8~72자"
                  secureTextEntry
                  autoComplete="new-password"
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
            accessibilityRole="button"
            accessibilityLabel="회원가입"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          >
            <Text className="font-pretendard-semibold text-base text-white">
              {isSubmitting ? '가입 중...' : '회원가입'}
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-6 gap-1.5">
            <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark">
              이미 계정이 있으세요?
            </Text>
            <Link href={'/(auth)/login' as never}>
              <Text className="font-pretendard-semibold text-sm text-primary">로그인</Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
