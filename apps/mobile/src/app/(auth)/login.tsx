// (auth)/login — 로그인 화면. D2에 react-hook-form + zodResolver로 구현.

import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.placeholder}>
        D2에서 구현 — react-hook-form + zodResolver + auth lib Schema
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 16 },
  placeholder: { fontSize: 14, color: '#888' },
});
