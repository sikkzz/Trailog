// moments/[momentId] — Moment 상세 화면.
//
// D3 — Moment 정보(제목/시간) 표시. 사진 grid는 D4에서 photos lib + useMomentPhotos.
// 참조 코드 비교 + RN 기본 문법은 login.tsx 헤더 참고.
//
// 학습 포인트:
//   - useLocalSearchParams로 라우트 param 읽기 (Next.js의 useParams 대응)
//   - 리스트 query 캐시에서 find — 별도 fetch 없이 즉시 표시 (D3 단순화)
//   - 더 정확한 패턴: useQueryClient().getQueryData 또는 useQuery({ ... initialData })

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMoments } from '../../lib/moments';

export default function MomentDetailScreen() {
  const { momentId } = useLocalSearchParams<{ momentId: string }>();
  const router = useRouter();
  const { data } = useMoments(); // 리스트 캐시 활용
  const moment = data?.moments.find((m) => m.id === momentId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← 뒤로</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {moment ? (
          <>
            <Text style={styles.title}>{moment.title}</Text>
            {moment.startedAt && (
              <Text style={styles.meta}>시작: {moment.startedAt.slice(0, 10)}</Text>
            )}
            {moment.endedAt && <Text style={styles.meta}>종료: {moment.endedAt.slice(0, 10)}</Text>}
            <Text style={styles.meta}>작성: {moment.createdAt.slice(0, 10)}</Text>
            <View style={styles.divider} />
            <Text style={styles.placeholder}>D4에서 구현 — 사진 grid + 업로드</Text>
          </>
        ) : (
          <Text style={styles.placeholder}>Moment를 찾을 수 없습니다 (id={momentId})</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  back: { fontSize: 16, color: '#1a73e8' },
  content: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  meta: { fontSize: 14, color: '#666', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  placeholder: { fontSize: 14, color: '#888' },
});
