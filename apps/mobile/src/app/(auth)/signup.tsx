// (auth)/signup — 회원가입 화면.
//
// Login과 동일 패턴 (RHF + zodResolver + RN Controller) — endpoint만 /auth/sign-up.
//
// **참조 코드 비교 + RN 기본 문법 해설은 login.tsx 헤더 주석 참고** (중복 박제 회피).
//
// SignUpRequestSchema는 SignInRequestSchema와 거의 동일하지만 password에 max(72) 추가
// (bcrypt 입력 한계 — 백엔드 검증과 일치).

import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>이메일 + 비밀번호 (8자 이상)</Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="user@trailog.app"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  editable={!isSubmitting}
                />
                {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="8~72자"
                  secureTextEntry
                  autoComplete="new-password"
                  editable={!isSubmitting}
                />
                {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
              </View>
            )}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? '가입 중...' : '회원가입'}</Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkPrompt}>이미 계정이 있으세요?</Text>
            <Link href={'/(auth)/login' as never} style={styles.link}>
              <Text style={styles.linkText}>로그인</Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
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
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonPressed: { backgroundColor: '#155cb0' },
  buttonDisabled: { backgroundColor: '#9bb8e0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 6 },
  linkPrompt: { fontSize: 14, color: '#666' },
  link: {},
  linkText: { fontSize: 14, color: '#1a73e8', fontWeight: '600' },
});
