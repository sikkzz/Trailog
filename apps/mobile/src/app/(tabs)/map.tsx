// (tabs)/map — 지도 탭. Phase 2 4.7에 react-native-maps 또는 MapLibre 도입.

import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Text style={styles.placeholder}>Phase 2 4.7에서 구현 — 사진 pin + PostGIS 공간 쿼리</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 16 },
  placeholder: { fontSize: 14, color: '#888' },
});
