// ShareModal — 사진/Moment 공유 링크 생성 모달 (Phase 3 5.1 D5).
//
// 흐름:
//   1. props로 target(photo/moment) + targetId 받음
//   2. 만료 시간 / 비밀번호 / EXIF strip 정책 선택
//   3. "링크 만들기" → useCreateShare → 토큰 발급
//   4. URL 표시 + RN built-in Share API (iOS/Android 공유 시트)
//
// 디자인 — RN built-in Modal + NativeWind. 별도 lib 도입 X (단순함 우선).
// Bottom Sheet 같은 폴리시는 4.9 또는 종료 후 wave에서 검토.

import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share as RNShare,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useCreateShare, type ExifStripPolicy, type ShareTarget } from '../../lib/shares';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  target: ShareTarget;
  targetId: string;
}

/** 만료 시간 옵션 — 1시간/1일/1주/영구 */
const EXPIRES_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '1시간', hours: 1 },
  { label: '1일', hours: 24 },
  { label: '1주', hours: 24 * 7 },
  { label: '영구', hours: null },
];

const STRIP_OPTIONS: { label: string; value: ExifStripPolicy; description: string }[] = [
  { label: 'GPS만 제거', value: 'gps_only', description: '위치 정보만 제거 (기본)' },
  { label: '모든 EXIF 제거', value: 'all', description: '디바이스/날짜 등 모두 제거' },
  { label: '원본 그대로', value: 'none', description: '메타데이터 보존' },
];

export function ShareModal({ visible, onClose, target, targetId }: ShareModalProps) {
  const createMutation = useCreateShare();
  const [expiresHours, setExpiresHours] = useState<number | null>(24); // default 1일
  const [password, setPassword] = useState('');
  const [exifPolicy, setExifPolicy] = useState<ExifStripPolicy>('gps_only');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const isPending = createMutation.isPending;

  const handleCreate = () => {
    const expiresAt =
      expiresHours !== null
        ? new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString()
        : undefined;

    createMutation.mutate(
      {
        target,
        targetId,
        ...(expiresAt ? { expiresAt } : {}),
        ...(password.length >= 4 ? { password } : {}),
        exifStripPolicy: exifPolicy,
      },
      {
        onSuccess: (data) => {
          setCreatedUrl(data.shareUrl);
        },
        onError: (e) => {
          const message = e instanceof Error ? e.message : '공유 링크 생성 실패';
          Alert.alert('공유 링크 생성 실패', message);
        },
      },
    );
  };

  const handleShareNative = async () => {
    if (!createdUrl) return;
    try {
      await RNShare.share({
        url: createdUrl,
        message: createdUrl,
      });
    } catch (e) {
      // 사용자가 공유 시트 dismiss — silent
      void e;
    }
  };

  const handleCopyLink = async () => {
    if (!createdUrl) return;
    try {
      await Clipboard.setStringAsync(createdUrl);
      // 단순 Alert — Toast는 RN 별도 lib 필요 (5.4 폴리시에 검토)
      Alert.alert('복사됨', '공유 링크가 클립보드에 복사됐어요.');
    } catch (e) {
      const message = e instanceof Error ? e.message : '복사 실패';
      Alert.alert('복사 실패', message);
    }
  };

  const handleClose = () => {
    setCreatedUrl(null);
    setPassword('');
    setExpiresHours(24);
    setExifPolicy('gps_only');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="모달 닫기"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-background dark:bg-background-dark rounded-t-2xl p-6"
        >
          <View className="items-center mb-4">
            <View className="w-10 h-1 bg-border dark:bg-border-dark rounded-full" />
          </View>

          <Text className="font-pretendard-bold text-xl text-text-primary dark:text-text-primary-dark mb-1">
            {createdUrl ? '공유 링크가 만들어졌어요' : '공유 링크 만들기'}
          </Text>
          <Text className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-6">
            {createdUrl
              ? '아래 URL을 외부에 공유하세요'
              : target === 'photo'
                ? '이 사진을 외부 사람에게 공유합니다'
                : '이 Moment 전체를 외부 사람에게 공유합니다'}
          </Text>

          {!createdUrl ? (
            <>
              {/* 만료 시간 */}
              <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                만료 시간
              </Text>
              <View className="flex-row gap-2 mb-5">
                {EXPIRES_OPTIONS.map((opt) => {
                  const selected = expiresHours === opt.hours;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => setExpiresHours(opt.hours)}
                      disabled={isPending}
                      className={`flex-1 py-3 rounded-md items-center ${
                        selected
                          ? 'bg-primary'
                          : 'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark'
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`만료 ${opt.label}`}
                      accessibilityState={{ selected }}
                    >
                      <Text
                        className={`font-pretendard-medium text-sm ${
                          selected ? 'text-white' : 'text-text-primary dark:text-text-primary-dark'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 비밀번호 (옵션) */}
              <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                비밀번호 (선택, 4자 이상)
              </Text>
              <TextInput
                className="font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border border-border dark:border-border-dark rounded-md px-3.5 py-3 mb-5"
                placeholderTextColor="#999"
                placeholder="비밀번호 (옵션)"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry
                editable={!isPending}
              />

              {/* EXIF strip 정책 */}
              <Text className="font-pretendard-medium text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                EXIF 메타데이터
              </Text>
              <View className="gap-2 mb-6">
                {STRIP_OPTIONS.map((opt) => {
                  const selected = exifPolicy === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setExifPolicy(opt.value)}
                      disabled={isPending}
                      className={`p-3.5 rounded-md border-2 ${
                        selected
                          ? 'border-primary bg-primary-50 dark:bg-primary-900'
                          : 'border-border dark:border-border-dark bg-surface dark:bg-surface-dark'
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`${opt.label} — ${opt.description}`}
                      accessibilityState={{ selected }}
                    >
                      <Text className="font-pretendard-semibold text-sm text-text-primary dark:text-text-primary-dark mb-0.5">
                        {opt.label}
                      </Text>
                      <Text className="font-pretendard text-xs text-text-secondary dark:text-text-secondary-dark">
                        {opt.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 생성 버튼 */}
              <Pressable
                onPress={handleCreate}
                disabled={isPending}
                className={`bg-primary rounded-md py-3.5 items-center active:opacity-80 ${
                  isPending ? 'opacity-50' : ''
                }`}
                accessibilityRole="button"
                accessibilityLabel="공유 링크 만들기"
                accessibilityState={{ disabled: isPending, busy: isPending }}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-pretendard-semibold text-base text-white">링크 만들기</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              {/* 생성된 URL + 공유 버튼 */}
              <View className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md p-4 mb-4">
                <Text
                  className="font-pretendard text-sm text-text-primary dark:text-text-primary-dark"
                  selectable
                >
                  {createdUrl}
                </Text>
              </View>

              <Pressable
                onPress={handleShareNative}
                className="bg-primary rounded-md py-3.5 items-center active:opacity-80 mb-2"
                accessibilityRole="button"
                accessibilityLabel="공유 시트 열기"
                accessibilityHint="시스템 공유 시트로 URL 보내기"
              >
                <Text className="font-pretendard-semibold text-base text-white">공유하기</Text>
              </Pressable>

              {/* 링크 복사 — primary outline (공유하기보다 한 단계 약한 시각) */}
              {/* 닫기 버튼은 박지 않음 — 외부 탭 + grabber + Android back button으로 dismiss 박힘 (네이티브 친화) */}
              <Pressable
                onPress={handleCopyLink}
                className="border-2 border-primary rounded-md py-3 items-center active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="링크 복사"
                accessibilityHint="공유 URL을 클립보드에 복사"
              >
                <Text className="font-pretendard-semibold text-base text-primary">링크 복사</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
