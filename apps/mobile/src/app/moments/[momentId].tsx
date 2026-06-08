// moments/[momentId] — Moment 상세 화면. Moment 정보 + 사진 grid.
//
// 참조 코드 비교 + RN 기본 문법은 login.tsx 헤더 참고.
// Phase 2 4.8 D3-5 — StyleSheet → NativeWind 마이그레이션 (ADR-0011).
//
// 이 화면에서 새로 등장하는 RN 패턴:
//   - `<Image source={{uri}}>` / `expo-image` `<Image>` — 캐시 + blurhash + transition
//   - `FlatList numColumns={3}` — 3열 grid
//   - `Dimensions.get('window')` + `aspectRatio: 1` — 정사각 grid item
//
// processingStatus 분기 UI (Phase 2 4.4):
//   - 'done'    → thumbnailUrls.small (정상 grid card)
//   - 'pending' → originalUrl + "처리 중" overlay
//   - 'failed'  → originalUrl + "처리 실패" overlay
//
// 사진 업로드 흐름 (D4c):
//   1. ＋사진 버튼 → ImagePicker.requestMediaLibraryPermissionsAsync()
//   2. ImagePicker.launchImageLibraryAsync() → 갤러리 modal → 사용자 선택
//   3. extension 추출 (jpg/png/heic/webp만)
//   4. useUploadPhoto mutation (presigned → R2 PUT → confirm)
//   5. 성공 시 photosKeys.list invalidate → grid 자동 refresh (pending 상태 표시)

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMoments } from '../../lib/moments';
import {
  useMomentPhotos,
  useUploadPhoto,
  type AllowedPhotoExt,
  type PhotoListItem,
} from '../../lib/photos';

const ALLOWED_EXTS: AllowedPhotoExt[] = ['jpg', 'jpeg', 'png', 'heic', 'webp'];

const GRID_COLUMNS = 3;
const GRID_GAP = 4;
// 화면 width - 양쪽 padding(16*2) - 사이 gap(2) = item 3개
const ITEM_SIZE =
  (Dimensions.get('window').width - 32 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function MomentDetailScreen() {
  const { momentId } = useLocalSearchParams<{ momentId: string }>();
  const router = useRouter();
  const { data: momentsData } = useMoments();
  const moment = momentsData?.moments.find((m) => m.id === momentId);
  const {
    data: photosData,
    isLoading: photosLoading,
    isError: photosError,
    refetch: refetchPhotos,
  } = useMomentPhotos(momentId);
  const uploadMutation = useUploadPhoto(momentId);

  // pull-to-refresh 전용 state — polling refetch는 false 유지 (RefreshControl 안 보임).
  // useQuery의 isRefetching은 polling에도 true → RefreshControl이 매번 떴다 사라져 깜빡임.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetchPhotos();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchPhotos]);

  async function pickAndUpload() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('권한 필요', '설정에서 사진 접근 권한을 허용해주세요');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];

      const ext = extractExt(asset);
      if (!ext) {
        Alert.alert('지원 안 되는 형식', 'jpg/jpeg/png/heic/webp만 지원합니다');
        return;
      }
      uploadMutation.mutate(
        { fileUri: asset.uri, ext },
        {
          onError: (e) => {
            const message = e instanceof Error ? e.message : '사진 업로드 실패';
            Alert.alert('사진 업로드 실패', message);
          },
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : '사진 선택 중 오류';
      Alert.alert('오류', message);
    }
  }

  const isUploading = uploadMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      <View className="flex-row justify-between items-center px-5 py-3 border-b border-border dark:border-border-dark">
        <Pressable onPress={() => router.back()}>
          <Text className="font-pretendard text-base text-primary">← 뒤로</Text>
        </Pressable>
        <Pressable
          onPress={pickAndUpload}
          disabled={isUploading}
          className={`px-3 py-1.5 bg-primary rounded-full active:opacity-80 ${
            isUploading ? 'opacity-50' : ''
          }`}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="font-pretendard-semibold text-sm text-white">＋ 사진</Text>
          )}
        </Pressable>
      </View>

      {isUploading && (
        <View className="flex-row items-center gap-2 px-4 py-2.5 bg-primary-50 dark:bg-primary-900">
          <ActivityIndicator size="small" />
          <Text className="font-pretendard-medium text-sm text-primary dark:text-primary-200">
            업로드 중...
          </Text>
        </View>
      )}

      {moment ? (
        <View className="px-4 pt-4 pb-3 border-b border-border dark:border-border-dark">
          <Text className="font-pretendard-bold text-2xl text-text-primary dark:text-text-primary-dark mb-2">
            {moment.title}
          </Text>
          {moment.startedAt && (
            <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-0.5">
              시작: {moment.startedAt.slice(0, 10)}
            </Text>
          )}
          {moment.endedAt && (
            <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-0.5">
              종료: {moment.endedAt.slice(0, 10)}
            </Text>
          )}
          <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-0.5">
            작성: {moment.createdAt.slice(0, 10)}
          </Text>
        </View>
      ) : (
        <View className="px-4 pt-4 pb-3 border-b border-border dark:border-border-dark">
          <Text className="font-pretendard text-sm text-text-tertiary dark:text-text-tertiary-dark">
            Moment를 찾을 수 없습니다 (id={momentId})
          </Text>
        </View>
      )}

      {photosLoading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" />
        </View>
      ) : photosError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="font-pretendard text-sm text-danger mb-4">사진을 불러오지 못했어요</Text>
          <Pressable
            onPress={() => refetchPhotos()}
            className="px-5 py-2.5 bg-primary rounded-md active:opacity-80"
          >
            <Text className="font-pretendard-semibold text-sm text-white">다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={photosData?.photos ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PhotoGridItem photo={item} momentId={momentId} />}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          ListEmptyComponent={<EmptyPhotos />}
          onRefresh={handleRefresh}
          refreshing={isManualRefreshing}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * 단일 사진 grid item.
 * processingStatus 분기:
 *   - 'done' → thumbnailUrls.small (없으면 originalUrl)
 *   - 'pending'/'failed' → originalUrl + overlay
 *
 * 탭 시 photos/[photoId] 상세 진입 — momentId를 query param으로 전달.
 */
function PhotoGridItem({ photo, momentId }: { photo: PhotoListItem; momentId: string }) {
  const router = useRouter();
  const imageUri = photo.thumbnailUrls?.small ?? photo.originalUrl;
  const showOverlay = photo.processingStatus !== 'done';

  return (
    <Pressable
      style={{ width: ITEM_SIZE, aspectRatio: 1 }}
      className="rounded overflow-hidden bg-surface dark:bg-surface-dark"
      onPress={() => router.push(`/photos/${photo.id}?momentId=${momentId}` as never)}
    >
      <Image
        source={{ uri: imageUri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={200}
      />
      {showOverlay && (
        <View className="absolute inset-0 bg-black/40 items-center justify-center">
          <Text className="font-pretendard-semibold text-xs text-white">
            {photo.processingStatus === 'pending' ? '처리 중…' : '처리 실패'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * 사진 확장자 추출. expo-image-picker asset에서:
 *   1. fileName (iOS는 보통 박힘, Android는 종종 누락)
 *   2. uri 마지막 . 부분 (fallback — file:///path/IMG_1234.HEIC 같은 형식)
 * 둘 다 ALLOWED_EXTS에 없으면 null.
 */
function extractExt(asset: ImagePicker.ImagePickerAsset): AllowedPhotoExt | null {
  const candidates = [
    asset.fileName?.split('.').pop()?.toLowerCase(),
    asset.uri.split('?')[0].split('.').pop()?.toLowerCase(),
  ];
  for (const c of candidates) {
    if (c && (ALLOWED_EXTS as string[]).includes(c)) {
      return c as AllowedPhotoExt;
    }
  }
  return null;
}

function EmptyPhotos() {
  return (
    <View className="flex-1 items-center justify-center p-10">
      <Text className="font-pretendard-medium text-base text-text-secondary dark:text-text-secondary-dark mb-2">
        아직 사진이 없어요
      </Text>
      <Text className="font-pretendard text-sm text-text-tertiary dark:text-text-tertiary-dark text-center leading-5">
        우측 상단 ＋ 사진 버튼으로{'\n'}첫 사진을 올려보세요
      </Text>
    </View>
  );
}
