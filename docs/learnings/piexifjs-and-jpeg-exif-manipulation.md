# piexifjs와 JPEG EXIF 저수준 조작

> **작성일**: 2026-07-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #2 이미지/미디어 심화 + 프라이버시
> **관련 문서**: [ADR-0015 EXIF strip sharp](../decisions/0015-exif-strip-sharp.md), [Phase 3 Spec 4.2](../specs/phase-03-sharing.md), [exif-and-photo-metadata.md](./exif-and-photo-metadata.md)

---

## 한 줄 요약

**piexifjs = JavaScript로 JPEG의 EXIF IFD를 직접 파싱/수정/재저장**. sharp의 `withMetadata()`는 GPS만 선택적으로 제거 불가 (전체 유지 or 전체 제거만) — Trailog "GPS만 제거하고 촬영 시각은 보존" 정책엔 부적합. piexifjs로 JPEG APP1 마커 안 GPS IFD만 정확히 삭제. Phase 3 5.2 EXIF strip 채택의 실제 정복.

## 우리 프로젝트에서 어디에 쓰이는가

- **Phase 3 5.2** — 공유 사진 GPS strip
- 백엔드 `apps/server/src/photos/photos.service.ts`
  - `stripGpsWithPiexif(buffer)` — JPEG GPS IFD 제거 후 buffer 반환
  - Lazy 캐싱 흐름의 stripping 단계
- 정책별 분기:
  - `gps_only` → piexifjs로 GPS만 제거 (촬영 시각 등 나머지 EXIF 보존)
  - `all` → sharp default strip (전체 EXIF 제거)
  - `none` → 원본 그대로

## 배경 — 왜 sharp 만으로 부족한가

### sharp의 EXIF 처리 한계

```typescript
// sharp — 전부 제거 or 전부 유지
await sharp(input).jpeg().toBuffer();
// → default: EXIF 전부 제거

await sharp(input).withMetadata().jpeg().toBuffer();
// → EXIF 전부 유지 (GPS 포함)

// ❌ 선택적 제거 불가
await sharp(input).withMetadata({ gps: false }).jpeg().toBuffer();
// 이런 API 없음
```

**sharp 근본 한계**:

- libvips 위에 얹은 wrapper — libvips는 이미지 프로세싱 최적화가 목적, 메타데이터는 부수
- **GPS 필드만 지정 삭제 API 없음** (v0.34 기준)
- `withExif({ IFD0: {...} })` 로 IFD0 덮어쓰기는 가능하지만 나머지 IFD (특히 GPS IFD) 개별 제어 X

### Trailog 정책 요구사항

```
gps_only 정책: 위치 정보 제거됨 (촬영 시각/카메라 정보/썸네일 유지)
```

- 촬영 시각(`DateTimeOriginal`) 보존 → 외부 공유 시 언제 찍었는지 정보 유용
- 카메라 정보(`Make`/`Model`) 보존 — 사진 UX 정보
- GPS만 삭제

→ **sharp 만으론 불가**. piexifjs로 JPEG 파일 구조 직접 조작.

## piexifjs 기본

### 설치 + import

```bash
pnpm add piexifjs
```

```typescript
// piexifjs는 CommonJS + @types 없음 → 최소 타입 선언
declare module 'piexifjs' {
  export function load(binary: string): {
    '0th': Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    Interop: Record<number, unknown>;
    '1st': Record<number, unknown>;
    thumbnail: string | null;
  };
  export function dump(exifObj: object): string;
  export function insert(exifStr: string, binary: string): string;
  export function remove(binary: string): string; // 전체 EXIF 삭제
}
```

### 3가지 핵심 API

```typescript
import piexif from 'piexifjs';

// 1. load — JPEG binary → EXIF object
const exif = piexif.load(jpegAsBinaryString);

// 2. dump — EXIF object → EXIF binary string (APP1 marker payload)
const exifBinary = piexif.dump(exif);

// 3. insert — JPEG binary에 EXIF binary 박음 (기존 APP1 대체)
const newJpeg = piexif.insert(exifBinary, jpegBinary);
```

## Trailog GPS 제거 구현

```typescript
// apps/server/src/photos/photos.service.ts
import piexif from 'piexifjs';

/**
 * JPEG buffer에서 GPS IFD만 제거하고 나머지 EXIF는 유지.
 * (sharp의 withMetadata는 전부/없음만 지원, piexifjs로 부분 제거)
 */
private stripGpsWithPiexif(jpegBuffer: Buffer): Buffer {
  // 1. Buffer → binary string (piexifjs 요구 형식)
  const jpegBinary = jpegBuffer.toString('binary');

  try {
    // 2. EXIF 파싱
    const exif = piexif.load(jpegBinary);

    // 3. GPS IFD 완전 제거 — {} 빈 객체로 대체
    exif.GPS = {};

    // 4. 나머지 IFD 유지한 채 dump + insert
    const exifBinary = piexif.dump(exif);
    const strippedBinary = piexif.insert(exifBinary, jpegBinary);

    // 5. binary string → Buffer
    return Buffer.from(strippedBinary, 'binary');
  } catch (e) {
    // EXIF 파싱 실패 (JPEG 아닌 것/깨진 것) — fallback: sharp 전체 strip
    this.logger.warn(`piexif 실패 (${e}), sharp default strip으로 fallback`);
    return sharp(jpegBuffer).toBuffer(); // withMetadata 없음 → 전체 EXIF 제거
  }
}
```

### 핵심 포인트

1. **`Buffer.toString('binary')`** — piexifjs는 binary string (Latin-1 encoding) 요구. `utf-8` 으로 하면 깨짐.
2. **`exif.GPS = {}`** — 빈 객체로 덮어쓰면 dump 시 GPS IFD 자체가 안 만들어짐.
3. **`Buffer.from(str, 'binary')`** — 역변환. 다시 binary string으로 파싱.
4. **try/catch fallback** — JPEG 아닌 파일 or 깨진 EXIF 대비. sharp 전체 strip으로 안전 fallback.
5. **PNG/HEIC는 fallback으로** — piexifjs는 JPEG 전용

## JPEG 파일 구조 (piexifjs가 다루는 세계)

### JPEG 마커 개관

```
0xFFD8       SOI (Start of Image)
0xFFE0..FFEF APPn (Application Segment) — EXIF는 여기 APP1
0xFFDB       DQT (Quantization Table)
0xFFC4       DHT (Huffman Table)
0xFFC0..FFC3 SOF (Start of Frame)
0xFFDA       SOS (Start of Scan)
0xFFD9       EOI (End of Image)
```

**EXIF 위치**: **APP1 (0xFFE1)** 마커 안. `Exif\0\0` 시그니처 뒤에 TIFF 구조 IFD 트리.

### EXIF IFD 트리 (piexifjs가 파싱하는 대상)

```
APP1 marker
└── TIFF header
    ├── IFD0 (Primary Image) — 이미지 자체 메타 (Make, Model, Orientation, ...)
    │   ├── Exif IFD pointer → Exif SubIFD (DateTimeOriginal, ExposureTime, ...)
    │   ├── GPS IFD pointer → GPS SubIFD (Latitude, Longitude, ...)  ← 여기 삭제
    │   └── Interop IFD pointer → Interop SubIFD (드묾)
    └── IFD1 (Thumbnail) — 썸네일 데이터
```

**piexifjs 매핑**:

- `exif['0th']` = IFD0
- `exif.Exif` = Exif SubIFD
- `exif.GPS` = **GPS SubIFD** — 여기가 삭제 대상
- `exif.Interop` = Interop SubIFD
- `exif['1st']` = IFD1 (썸네일 메타)
- `exif.thumbnail` = 실제 썸네일 JPEG binary

**GPS SubIFD 삭제 = 나머지 EXIF 전부 보존한 채 위치 정보만 제거**.

## exifreader vs piexifjs 역할 분리 (Trailog)

Trailog는 두 라이브러리를 다른 목적으로 씀:

### exifreader — 읽기 전용 (Phase 2 4.5)

```typescript
import ExifReader from 'exifreader';
const tags = ExifReader.load(buffer, { expanded: true });
// - takenAt, GPS location 추출 → DB 저장
// - EXIF 전체 원본 exif_json에 보존
```

**특징**:

- **읽기만** — 파일 수정 X
- pure JS (Fly.io 256MB 안전 — libvips 무거움 회피)
- HEIC/PNG/TIFF 다 지원
- expanded mode에서 GPS → decimal 자동 변환

### piexifjs — 수정 (Phase 3 5.2)

- **JPEG 전용** — HEIC/PNG는 sharp fallback
- **binary in/out** — Buffer/binary string 변환 필요
- GPS SubIFD 삭제 같은 부분 조작 가능

### 함께 쓰는 이유

- 업로드 시점 exifreader로 메타 추출 → DB 저장
- 공유 시점 piexifjs로 GPS 삭제 → R2 캐싱

## Lazy 캐싱 흐름과 조합

```typescript
// apps/server/src/photos/photos.service.ts
private async getOrCreateStrippedKey(
  photo: Photo,
  variant: 'gps_only' | 'all',
): Promise<string> {
  const strippedKeys = photo.strippedKeys ?? {};

  // 1. 이미 있으면 재사용 (SHA256 동일 검증도 완료)
  if (strippedKeys[variant]) return strippedKeys[variant];

  // 2. 원본 R2에서 fetch
  const originalBuffer = await this.r2Service.getObjectBuffer(photo.originalKey);

  // 3. 정책별 strip
  let strippedBuffer: Buffer;
  if (variant === 'gps_only' && this.isJpeg(photo.originalKey)) {
    strippedBuffer = this.stripGpsWithPiexif(originalBuffer);
  } else {
    // all 정책 or JPEG 아닌 경우 → sharp 전체 strip
    strippedBuffer = await sharp(originalBuffer).toBuffer();
  }

  // 4. R2에 stripped/ prefix로 저장
  const strippedKey = this.buildStrippedKey(photo, variant);
  await this.r2Service.putObjectBuffer(strippedKey, strippedBuffer, 'image/jpeg');

  // 5. DB에 캐시 반영
  strippedKeys[variant] = strippedKey;
  await this.photoRepo.update(photo.id, { strippedKeys: strippedKeys as never });

  return strippedKey;
}
```

**Lazy 이유**:

- 사진 업로드 시점에 미리 strip? → R2 저장 비용 증가 (2배)
- 실제 공유 시점에 처음 요청 오면 strip → 사용 안 하는 사진은 비용 0
- 두 번째 다운로드부턴 캐싱된 파일 재사용 (SHA256 같음)

## 검증 — exiftool로 확인

```bash
# 원본 (GPS 있음)
exiftool -GPSLatitude -GPSLongitude ~/photo-original.jpeg
# GPS Latitude                    : 37 deg 33' 59.40" N
# GPS Longitude                   : 126 deg 58' 40.80" E

# gps_only strip 후
exiftool -GPSLatitude -GPSLongitude ~/photo-stripped-gps_only.jpeg
# (출력 없음 — GPS 태그 없음)

# 촬영 시각은 유지되는지
exiftool -DateTimeOriginal ~/photo-stripped-gps_only.jpeg
# Date/Time Original              : 2026:06:14 05:30:00
```

**Trailog Phase 3 5.2 자동화 검증** — Chrome DevTools MCP + exiftool로 T2 통과.

## 함정 (10종)

### 1. `Buffer.toString('utf-8')` 실수

piexifjs는 **binary string** 요구. utf-8로 변환하면 non-ASCII 바이트 (예: 0x80 이상) 왜곡:

```typescript
// ❌ 왜곡됨
const bin = buffer.toString(); // default utf-8

// ✅
const bin = buffer.toString('binary'); // Latin-1
```

### 2. binary string 정체 (일반 string 아님)

binary string은 각 char code = 원본 byte value인 특수 문자열. **JSON.stringify/split/slice 안전 X**. piexifjs 안에서만 다루고 외부로 노출 X.

### 3. HEIC/PNG는 piexifjs 못 씀

```typescript
// ❌ HEIC 넘기면 throw
piexif.load(heicBinary); // Error: Given data is not jpeg.

// ✅ JPEG 확인 후 처리, 아니면 sharp fallback
if (photo.originalKey.endsWith('.jpg') || photo.originalKey.endsWith('.jpeg')) {
  return stripGpsWithPiexif(buffer);
} else {
  return sharp(buffer).toBuffer();
}
```

### 4. `exif.GPS = null` 대신 `{}` 활용

```typescript
// ❌ 일부 버전에서 dump 시 null 처리 이상
exif.GPS = null as never;

// ✅ 빈 객체로 (안전)
exif.GPS = {};
```

### 5. GPS 태그 하나만 지우면 나머지 잔존

```typescript
// ❌ Latitude만 지움 — Longitude/Altitude 등 나머지 잔존
delete exif.GPS[piexif.GPSIFD.GPSLatitude];

// ✅ SubIFD 전체 대체
exif.GPS = {};
```

### 6. sharp 파이프라인 후 EXIF 다시 박기 시도

```typescript
// ❌ sharp 처리 후 다시 piexif 붙이면 이중 처리
const resized = await sharp(input).resize(800).toBuffer();
const withOldExif = piexif.insert(oldExifBinary, resized.toString('binary'));

// ✅ sharp 먼저 → piexifjs가 원본 위에 정확히 EXIF 재구성
// 또는 sharp의 withMetadata를 활용 (Trailog는 원본 크기 그대로 strip이라 sharp 우회)
```

### 7. thumbnail 필드 오해

```typescript
exif.thumbnail; // JPEG 안 IFD1의 썸네일 binary
```

- 이건 EXIF 필드 아니라 별도 dump 대상
- 삭제 원하면 `exif.thumbnail = null; exif['1st'] = {};`
- Trailog는 썸네일 EXIF 처리 필요성 X (sharp가 별도 3-size 썸네일 생성)

### 8. Fly.io 256MB memory 한계

piexifjs는 pure JS라 sharp보다 훨씬 가벼움. 다만 **큰 사진(50MB+ RAW)** 처리 시 buffer 2배 (원본 + stripped) → 메모리 압박. 실서비스에선 스트리밍 처리 검토.

**Trailog 현재**: 업로드 시 sharp가 이미 resize → 큰 파일은 stripped 대상 아님 (썸네일이 대상). 문제 X.

### 9. TypeScript 타입 없음 (`@types/piexifjs` X)

수동 declare module 박음:

```typescript
declare module 'piexifjs' {
  export function load(binary: string): { ... };
  // ...
}
```

`apps/server/src/types/piexifjs.d.ts` 신규 파일 or `photos.service.ts` 상단.

### 10. tests에서 실제 JPEG 파일 필요

unit test로 mock buffer 만들기 어려움 (실제 EXIF 구조 요구). fixture로 실제 사진 파일 활용:

```
apps/server/test/fixtures/with-gps.jpeg  ← 실제 GPS 박힌 사진
apps/server/test/fixtures/no-gps.jpeg     ← 스크린샷 등
```

## Trailog 결정 흐름

1. **초기 (5.2 Wave 시작)** — sharp `withMetadata()` 로 EXIF 전체 유지, GPS 개별 제거 시도
2. **한계 발견** — sharp API로 GPS 만 지정 삭제 불가
3. **piexifjs 조사** — JPEG APP1 IFD 직접 조작 가능 확인
4. **채택** — JPEG는 piexifjs, 나머지는 sharp fallback
5. **Lazy 캐싱 결합** — Phase 3 5.2 D1~D4 완료

**학습 자산**:

- JPEG 파일 구조 (SOI/APP1/DQT/DHT/SOF/SOS/EOI) 이해
- EXIF IFD 트리 (0th/Exif/GPS/Interop/1st) 명확화
- 이미지 처리 라이브러리는 각자 강점이 있고 **조합**이 실무 패턴

## Phase 후속 정복 항목

- **HEIC EXIF strip** — Apple HEIC 포맷 (iPhone default) — `piexifjs` 미지원. `heic-convert` 라이브러리 검토 or 업로드 시 JPEG 변환 (모바일 EAS build 시점)
- **RAW 파일 대응** — DNG/CR3/ARW 등 — 사용 사례 발생 시
- **Video EXIF (metadata track)** — MP4/MOV의 위치 정보 — Phase 후속 영상 지원 시
- **워터마크 삽입** — piexifjs로 comment/copyright 필드 활용 가능

## 참고 링크

- [piexifjs GitHub](https://github.com/hMatoba/piexifjs)
- [JPEG File Interchange Format (JFIF)](https://www.w3.org/Graphics/JPEG/jfif3.pdf)
- [EXIF 2.32 Standard](https://www.cipa.jp/std/documents/e/DC-008-Translation-2019-E.pdf)
- [ADR-0015 EXIF strip sharp](../decisions/0015-exif-strip-sharp.md)
- [exif-and-photo-metadata.md — Phase 2 4.5 학습](./exif-and-photo-metadata.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
