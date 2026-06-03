// (auth)/login — 로그인 화면.
//
// RHF + zodResolver + RN 컴포넌트 패턴 (ADR-0008 적용 시작).
//
// =============================================================================
// 1. 참조 (Next.js Web) ↔ Trailog (RN) 차이 — 패턴/도구 관점
// =============================================================================
//
// | 항목          | 참조                                              | Trailog (RN)                        |
// | ------------- | ------------------------------------------------- | ----------------------------------- |
// | Form UI       | shadcn `<Form><FormField>` Radix wrapper          | RHF `Controller` 직접 (shadcn X)    |
// | Input         | shadcn `<MainInput>` (Tailwind)                   | RN `<TextInput>` + StyleSheet       |
// | Button        | `<MainButton>` (Tailwind hover/active)            | RN `<Pressable>` (pressed state)    |
// | Text          | `<h2>` / `<p>` (HTML)                             | RN `<Text>` (모든 텍스트 강제)      |
// | 클릭          | `onClick`                                         | `onPress`                           |
// | 스타일        | Tailwind class                                    | `StyleSheet.create` + style prop    |
// | 키보드 회피   | 자동 (브라우저)                                   | `KeyboardAvoidingView` 명시         |
// | 안전 영역     | 자동                                              | `SafeAreaView` 명시                 |
// | 에러 표시     | shadcn `<FormMessage>`                            | `<Text>`로 직접 렌더                |
//
// =============================================================================
// 2. RN 기본 문법 해설 (본인 React/Next 익숙 → RN 처음)
// =============================================================================
//
// 본인이 React/Next.js는 익숙 — RN의 컴포넌트/스타일링은 처음. 이 화면에서 새로 등장하는 것:
//
// | RN 컴포넌트           | 의미 + Web 대응                                                              |
// | --------------------- | ---------------------------------------------------------------------------- |
// | `<View>`              | `<div>` 대응. RN의 default 박스. flex 기본 + flexDirection 기본 column.      |
// | `<Text>`              | RN 핵심 룰 — **모든 텍스트는 반드시 `<Text>` 안에**. JSX string 직접 X.       |
// | `<TextInput>`         | `<input>` 대응. `keyboardType="email-address"`가 web의 type 역할.             |
// | `<Pressable>`         | `<button>` 대응. `onPress={fn}` + `({pressed})` 인자로 active style.          |
// | `<KeyboardAvoidingView>` | 입력 시 키보드가 input 가리지 않게 자동 회피. `behavior='padding'` iOS.   |
// | `<SafeAreaView>`      | 노치/홈 인디케이터 영역 안전 (iPhone X+ 위/아래 흰 영역).                    |
// | `Alert.alert()`       | `window.alert()` 대응. RN built-in modal.                                    |
// | `StyleSheet.create()` | CSS 없음. 스타일은 **객체**로. camelCase 키 (backgroundColor), 단위 X (16).  |
// | `style={[a, b]}`      | 스타일 배열 — 조건부 스타일 (Web의 cn() / clsx 대응).                        |
// | `onChangeText`        | TextInput 입력 이벤트 — string 직접 받음 (`e.target.value` 아님).            |
//
// **헷갈리기 쉬운 핵심**:
// - `flexDirection` 기본이 **column** (web은 row) — 박스가 위→아래 흐름
// - 단위는 숫자만 (`16`, `'50%'` 일부만) — px 안 박음, density-independent pt
// - `<Text>` 강제 — `<View>{text}</View>` 같이 string 직접 못 박음 (crash)
// - `onClick` → `onPress` 외엔 다른 핸들러도 RN 이름 (onChangeText, onLongPress 등)
//
// 자세한 RN 기본 문법은 D5 학습 노트 `react-native-fundamentals-for-web-devs.md` (예정).
//
// =============================================================================
// 3. 응답 검증
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>로그인</Text>
          <Text style={styles.subtitle}>이메일 + 비밀번호로 들어가기</Text>

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
                  placeholder="8자 이상"
                  secureTextEntry
                  autoComplete="password"
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
            <Text style={styles.buttonText}>{isSubmitting ? '로그인 중...' : '로그인'}</Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkPrompt}>처음이세요?</Text>
            <Link href={'/(auth)/signup' as never} style={styles.link}>
              <Text style={styles.linkText}>회원가입</Text>
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
