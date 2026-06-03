// photos/[photoId] — 사진 상세 화면. full-screen 이미지 + EXIF (촬영 시각/지도).
// D4에 expo-image 활용.

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotoDetailScreen() {
  const { photoId } = useLocalSearchParams<{ photoId: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Photo {photoId}</Text>
      <Text style={styles.placeholder}>
        D4에서 구현 — expo-image full-screen + takenAt + location
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#000' },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  placeholder: { fontSize: 14, color: '#888' },
});
