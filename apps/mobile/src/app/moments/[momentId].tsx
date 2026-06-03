// moments/[momentId] — Moment 상세 화면. 그 안의 사진 grid + 업로드 진입.
// D3 useMomentPhotos + D4 사진 업로드 진입.

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MomentDetailScreen() {
  const { momentId } = useLocalSearchParams<{ momentId: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Moment {momentId}</Text>
      <Text style={styles.placeholder}>
        D3에서 구현 — useMomentPhotos query + 사진 grid + 업로드 버튼
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  placeholder: { fontSize: 14, color: '#888' },
});
