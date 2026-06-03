// (tabs)/moments — 메인 화면. 본인 Moment 리스트.
// D3에 React Query useMoments + FlatList 적용.

import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MomentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Moments</Text>
      <Text style={styles.placeholder}>D3에서 구현 — useMoments query + FlatList grid</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 16 },
  placeholder: { fontSize: 14, color: '#888' },
});
