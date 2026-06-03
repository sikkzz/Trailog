// (auth)/signup — 회원가입 화면. D2에 react-hook-form + zodResolver로 구현.

import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <Text style={styles.placeholder}>D2에서 구현 — 이메일/비밀번호 + zod 검증</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 16 },
  placeholder: { fontSize: 14, color: '#888' },
});
