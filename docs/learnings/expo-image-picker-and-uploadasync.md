# expo-image-picker + FileSystem.uploadAsync — RN 사진 선택 + R2 업로드

> **작성일**: 2026-06-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #2 이미지/미디어/파일 스트리밍 (PROJECT_ROOT 2장) — 모바일 측
> **관련 문서**: [Phase 2 Spec 4.6](../specs/phase-02-core-features.md), [R2 Presigned URL 기초](r2-presigned-url-basics.md), [sharp 이미지 처리](sharp-image-processing.md)

---

## 한 줄 요약

**사진 선택**: `expo-image-picker`로 권한 요청 → 갤러리 modal → `asset.uri` (file://). **R2 업로드**: `expo-file-system`의 `uploadAsync(BINARY_CONTENT)` — `fetch(uri).blob()`는 RN native에서 crash/빈 Blob 위험 → **Expo 표준 패턴**으로 native binary 직접 PUT.

## 우리 프로젝트에서 어디에 쓰이는가

Phase 2 4.6 D4 사진 업로드 흐름:

```
1. moments/[momentId] "+사진" 버튼
   ↓
2. ImagePicker.requestMediaLibraryPermissionsAsync()  (권한 요청)
   ↓
3. ImagePicker.launchImageLibraryAsync({...})  (갤러리 modal)
   ↓
4. asset.uri + ext 추출 → useUploadPhoto mutation
   ↓
5. uploadPhoto(momentId, fileUri, ext)
   ├── createPresignedUploadUrl → 백엔드가 presigned PUT URL 발급
   ├── FileSystem.uploadAsync(presignedUrl, fileUri, BINARY_CONTENT)  ← R2 직접 PUT
   └── confirmPhotoUpload → 백엔드에 완료 알림 + Photo row 생성
```

## 어떻게 동작하는가

### 1단계: 권한

iOS는 사진 접근 시 `NSPhotoLibraryUsageDescription` Info.plist 키 필수. 누락 시 즉시 **TCC crash**.

```tsx
const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!perm.granted) {
  Alert.alert('권한 필요', '설정에서 사진 접근 권한을 허용해주세요');
  return;
}
```

`app.json` plugins에 권한 메시지 박기 (한국어 가능):

```jsonc
{
  "plugins": [
    [
      "expo-image-picker",
      { "photosPermission": "Trailog가 사진을 업로드하기 위해 갤러리 접근이 필요합니다" },
    ],
  ],
}
```

⚠️ **plugin 변경 후 단순 `expo run:ios`만으론 Info.plist 반영 X**. `expo prebuild --clean` 후 재빌드 필요.

### 2단계: 갤러리 modal

```tsx
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'], // SDK 52+ string 배열 (구버전은 MediaTypeOptions.Images)
  allowsMultipleSelection: false, // 단일 사진 (다중은 후속)
  quality: 1, // 0~1, 1=원본
});

if (result.canceled || result.assets.length === 0) return;
const asset = result.assets[0];
// asset.uri: 'file:///var/mobile/Media/.../IMG_1234.JPG' (iOS) 또는 'ph://...' (PHAsset)
// asset.fileName: 'IMG_1234.JPG' (iOS만 박힘. Android는 종종 누락)
// asset.mimeType: 'image/jpeg'
```

### 3단계: 확장자 추출

백엔드에 ext 보내야 — presigned URL의 Content-Type + key 생성에 사용.

```tsx
function extractExt(asset: ImagePicker.ImagePickerAsset): AllowedPhotoExt | null {
  const candidates = [
    asset.fileName?.split('.').pop()?.toLowerCase(), // iOS: 'IMG_1234.JPG' → 'jpg'
    asset.uri.split('?')[0].split('.').pop()?.toLowerCase(), // fallback: uri 마지막 .
  ];
  for (const c of candidates) {
    if (c && ALLOWED_EXTS.includes(c)) return c as AllowedPhotoExt;
  }
  return null;
}
```

### 4단계 (핵심): R2 PUT — `FileSystem.uploadAsync`

**왜 fetch + blob이 안 되는가**:

```tsx
// ❌ RN native에서 crash 또는 빈 Blob 반환 가능
const response = await fetch(asset.uri);
const blob = await response.blob();
await fetch(presignedUrl, { method: 'PUT', body: blob });
```

- RN의 `fetch`는 `file://` URI를 일부 환경에서만 처리
- `Blob` polyfill이 native binary와 안 맞는 경우
- iOS PHAsset(`ph://`) URI는 더 까다로움

**Expo 표준 — `uploadAsync(BINARY_CONTENT)`**:

```tsx
import * as FileSystem from 'expo-file-system/legacy'; // SDK 56: uploadAsync는 legacy

const result = await FileSystem.uploadAsync(presignedUrl, fileUri, {
  httpMethod: 'PUT',
  uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  headers: { 'Content-Type': contentType },
});
if (result.status < 200 || result.status >= 300) {
  throw new Error(`R2 업로드 실패: ${result.status}`);
}
```

- **native binary 직접 PUT** — JS 메모리 안 거침
- `BINARY_CONTENT` mode: body로 파일 raw bytes (R2/S3 presigned PUT 필요한 형태)
- 대안 `MULTIPART`: multipart/form-data — 다른 API용

### SDK 56 변경 — `uploadAsync`는 legacy

Expo SDK 56부터 새 API (`UploadTask` class) 도입. 기존 `uploadAsync`는 `expo-file-system/legacy`로 이동.

```tsx
// SDK 52~55
import * as FileSystem from 'expo-file-system';

// SDK 56+
import * as FileSystem from 'expo-file-system/legacy';
```

새 API:

```tsx
import { UploadTask, UploadType } from 'expo-file-system';
const task = new UploadTask({ url, fileUri }, { type: UploadType.BINARY_CONTENT, headers });
const result = await task.uploadAsync();
```

Trailog는 legacy 채택 — 단순 + 안정. v2 전환은 후속.

## 핵심 개념

### iOS PHAsset (`ph://`) vs file URI

- 갤러리 사진 — `ph://...` (iCloud Photos Library asset)
- 카메라 직접 촬영 — `file:///...`
- `expo-image-picker` 보통 file:// 반환 (iCloud 동기화 자동)

### multipart vs binary content

| 모드             | 데이터              | 사용                                    |
| ---------------- | ------------------- | --------------------------------------- |
| `BINARY_CONTENT` | raw bytes           | S3/R2 presigned PUT, 단순 binary upload |
| `MULTIPART`      | multipart/form-data | 일반 REST API (보통 `field` + `file`)   |

R2 presigned URL은 binary 직접 받음 — `BINARY_CONTENT` 필수.

### 권한 처리 흐름

| iOS                                               | Android                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `NSPhotoLibraryUsageDescription` Info.plist 필수  | `READ_MEDIA_IMAGES` (Android 13+) 또는 `READ_EXTERNAL_STORAGE` |
| 첫 prompt 후 사용자가 거부 → 설정에서만 허용 가능 | 마찬가지                                                       |
| 첫 진입 시만 prompt — 그 후 자동 사용             | 동일                                                           |

```tsx
const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
if (perm.status === 'denied') {
  // 사용자에게 "설정에서 허용" 안내
  // Linking.openSettings() 호출 옵션
}
```

## 흔한 함정

1. **권한 메시지 누락 → TCC crash** — Info.plist에 `NSPhotoLibraryUsageDescription` 박혀있어야. plugin 변경은 `prebuild --clean` 필요.
2. **`fetch(file://).blob()` 사용** — 환경 따라 crash. `FileSystem.uploadAsync` 사용 표준.
3. **SDK 56의 `uploadAsync` 위치** — `expo-file-system` 직접 → `/legacy` 변경.
4. **`mediaTypes: 'images'` vs `MediaTypeOptions.Images`** — SDK 52+ string 배열 권장.
5. **fileName이 Android에서 null** — uri 기반 fallback 필수.
6. **Content-Type 불일치** — presigned URL 발급 시 박은 content-type과 PUT 시 헤더 일치해야 (R2 SignatureDoesNotMatch 403).
7. **HEIC 파일 size 큼** — iPhone 기본 포맷 + 백엔드 sharp의 libheif가 HEVC 미지원이면 fail (4.5 학습 노트 함정). 모바일 변환 또는 백엔드 libheif HEVC 설치.
8. **갤러리 비어있는 시뮬레이터** — 검증 시 Mac에서 이미지 드래그 추가 필요.
9. **progress UI** — `fetch`/`uploadAsync` 둘 다 RN에서 progress callback 없음. `XMLHttpRequest.upload.onprogress` 또는 `react-native-blob-util` 별도 도입.
10. **다중 선택 후 일괄 업로드** — `allowsMultipleSelection: true` + 각 asset에 mutation 호출. 동시 N개 = 메모리 spike — 직렬 처리 권장.

## 더 파볼 거리

- **progress UI** — `XMLHttpRequest` polyfill 또는 `react-native-blob-util` 도입
- **카메라 직접 촬영** — `ImagePicker.launchCameraAsync`
- **다중 선택 + 일괄 업로드 UX** — 진행률 / 실패 retry / 부분 성공
- **이미지 편집 (crop/회전)** — `expo-image-manipulator` (HEIC → JPEG 변환에도 활용)
- **background upload** — 앱 백그라운드 가도 업로드 계속 (`expo-background-task` 또는 native)
- **iCloud asset 처리** — `ph://` URI 다운로드 흐름
- **EXIF strip 시점** — Phase 3 공유 흐름에 강제 (4.5 학습 노트의 프라이버시 항목과 연결)

## 참고 링크

- [expo-image-picker 공식](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [expo-file-system 공식](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [Expo SDK 56 release notes](https://expo.dev/changelog/sdk-56) — uploadAsync legacy 이동
- [R2 / S3 presigned PUT 문서](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
