# ADR-0015: EXIF strip — sharp + piexifjs (2026-06-14 보강)

> **상태**: Accepted (2026-06-14 보강 — piexifjs 추가)
> **날짜**: 2026-06-09 (초안) / 2026-06-14 (보강)
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 3 Spec](../specs/phase-03-sharing.md), [ADR-0007 R2 스토리지](./0007-image-storage-r2.md), [exif-and-photo-metadata 학습 노트](../learnings/exif-and-photo-metadata.md)

---

## ⚠️ 2026-06-14 보강 — sharp 한계 발견 + piexifjs 추가

5.2 D3 구현 시점에 sharp `withExif()` 한계 발견:

- **sharp `withExif(exif)` — raw EXIF buffer 전체 교체**. 한 키(GPS)만 제거 불가.
- ExifReader 파싱 결과 → sharp withExif 입력 형식 변환은 복잡 (IFD0/IFD2/GPSIFD 등 raw).
- sharp는 GPS-only strip 단독 API 없음.

→ ADR-0015 초안 가정 "sharp `withExif()`로 GPS만 제거" 거짓. **`piexifjs` 추가** (27KB, JPEG/HEIC EXIF binary 직접 조작).

### 정정된 결정 (2026-06-14)

| variant                  | 도구          | 동작                                                                  |
| ------------------------ | ------------- | --------------------------------------------------------------------- |
| **all**                  | sharp default | 옵션 안 박으면 EXIF 자동 strip + re-encode                            |
| **gps_only (JPEG/HEIC)** | piexifjs      | GPS IFD만 제거 (re-encode 불필요 + 나머지 EXIF 보존 + quality 무손실) |
| **gps_only (PNG/WebP)**  | sharp default | EXIF 표준 X — sharp default strip fallback (사용자 의도 fit)          |

### 구현 (apps/server/src/photos/photos.service.ts)

```typescript
private async stripExif(buffer: Buffer, variant: 'all' | 'gps_only', ext: string): Promise<Buffer> {
  if (variant === 'all') {
    return sharp(buffer).toBuffer();  // default strip
  }
  // gps_only
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'heic') {
    return this.stripGpsWithPiexif(buffer);  // JPEG EXIF binary 조작
  }
  return sharp(buffer).toBuffer();  // PNG/WebP fallback
}

private stripGpsWithPiexif(buffer: Buffer): Buffer {
  try {
    const binary = buffer.toString('binary');
    const exifObj = piexif.load(binary);
    delete (exifObj as any).GPS;
    const newExifBinary = piexif.dump(exifObj);
    return Buffer.from(piexif.insert(newExifBinary, binary), 'binary');
  } catch (err) {
    this.logger.warn(`piexif failed, fallback to original: ${err}`);
    return buffer;  // EXIF 없는 JPEG 등 — 안정성 우선
  }
}
```

### Lazy 생성 + R2 캐싱

5.2 시점에 Photo entity에 `strippedKeys jsonb` 컬럼 추가 ({ all?, gps_only? }).
외부 공유 첫 접근 시점에 strip + R2 PUT + DB jsonb merge. 두 번째 접근부터 캐시 즉시.

### 추가 의존성 박제

- `piexifjs` v2.x (dep) — 27KB, JPEG EXIF binary 직접 조작
- `@types/piexifjs` (devDep) — type definitions

### 본 ADR 초안의 가정 정정

| 가정 (2026-06-09)                    | 실제 (2026-06-14)                            |
| ------------------------------------ | -------------------------------------------- |
| sharp `withExif()`로 GPS만 제거 가능 | ❌ raw buffer 전체 교체만 가능               |
| sharp만으로 충분                     | ❌ piexifjs 추가 필수 (JPEG/HEIC `gps_only`) |
| 새 lib 도입 X (기존 의존성 활용)     | 🔄 27KB 작은 lib 추가 (정직성 ↑)             |

---

---

## 맥락 (Context)

Phase 3 5.3 EXIF strip wave 진입 시 사진 공유 시 GPS/메타데이터 제거 도구 결정:

- **GPS 좌표만 strip** (기본 옵션 — 위치 누출 방지)
- **전체 EXIF strip** (옵션 — 디바이스/날짜 등 모두 제거)
- 원본은 R2에 보존, strip된 파일은 별도 prefix에 박힘

후보 lib:

1. **sharp** — Phase 2 4.4 worker에 이미 도입. `withMetadata()` / `withExif()` 지원
2. **exiftool spawn** — 가장 강력하지만 Node child_process + binary 의존
3. **piexifjs** — pure JS but 메타 일부만 처리

EXIF strip 깊이 학습은 메모리 `picker-exif-preservation-revisit` 트리거 (Phase 3 공유 흐름 시점에 능동 알림).

## 결정 (Decision)

**선택**: **sharp의 `pipeline.toBuffer()` 기본 동작 활용** — 옵션 명시 안 박으면 EXIF strip이 default. GPS 부분 보존 시 `keepMetadata()` 후 GPS 키만 명시 제거.

## 이유 / 트레이드오프

### 왜 sharp인가

- **기존 의존성** — Phase 2 4.4 worker에 이미 도입 (썸네일 + WebP 변환). 새 lib 도입 X.
- **default가 strip** — `sharp(input).resize(...).toBuffer()` 호출 시 EXIF 자동 제거 (옵션 안 박으면). 일관 + 단순.
- **선택 보존** — `withMetadata()` 또는 `withExif({...})`로 GPS만 제외하고 나머지 보존 가능.
- **WebP 출력** — 썸네일과 동일 포맷 + 통합 파이프라인.
- **성능** — libvips (C) 기반. Node spawn 대비 100배+ 빠름.

### 얻는 것

- 추가 의존성 X
- 기존 worker 패턴 그대로 (BullMQ + sharp)
- 학습 가치 ↑ — sharp metadata 처리 깊이 정복 (이미 학습한 영역)

### 포기하는 것

- **exiftool 깊은 처리** — XMP, IPTC, ICC profile 등 특수 메타 — sharp 한계 있음. 단 Trailog는 EXIF만 처리 → 무영향.
- **양방향 정확성** — exiftool은 GPS strip 후 다른 메타 100% 보존. sharp는 일부 부수 처리 가능 (Phase 후속 정밀 검증 필요).

### 학습 가치 관점

- **sharp metadata 처리 깊이** — Phase 2 4.4에선 thumbnail만. EXIF strip은 metadata 처리 본격 학습.
- **메모리 `picker-exif-preservation-revisit` 활성화** — Android picker 한계 + 실 사용자 손실 보고 검토 시점.
- **이미지 보안 영역 정복** — 학습 우선순위 #2 (이미지/미디어 처리) 깊이 ↑.

## 검토한 대안

| 대안                                   | 장점                                                 | 단점                                                      | 제외 이유                                 |
| -------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| **A. sharp `withMetadata()` strip** ⭐ | 기존 의존성 + default strip + 빠름 + 통합 파이프라인 | 특수 메타 정밀 처리 한계                                  | (채택)                                    |
| B. exiftool spawn                      | 가장 강력 + 정밀 + XMP/IPTC 처리                     | child_process + binary 의존 + 100x 느림 + Docker 이미지 ↑ | sharp로 충분. exiftool은 학술/포렌식 영역 |
| C. piexifjs                            | pure JS                                              | 메타 일부만 + 활성 maintainer ↓ + 큰 의존성               | sharp 대비 이점 X                         |
| D. 원본 그대로 + frontend에서 strip    | 백엔드 부담 X                                        | RN/mobile에서 strip 어려움 + 양 플랫폼 일관 X + 신뢰성 ↓  | 서버 단 strip이 보안/일관 둘 다 ↑         |

## 결과 / 영향

### 백엔드 (`apps/server/`)

#### Worker 확장 (Phase 3 5.3)

```typescript
// photos/processors/photo-processor.service.ts (확장)
async stripExif(buffer: Buffer, policy: ExifStripPolicy): Promise<Buffer> {
  const pipeline = sharp(buffer);

  if (policy === 'all') {
    // 옵션 안 박으면 default가 strip — 그대로 처리
    return pipeline.toBuffer();
  }

  if (policy === 'gps_only') {
    // 나머지 메타 보존 + GPS 키만 제거 — sharp의 withExif 활용
    const metadata = await pipeline.metadata();
    const exif = metadata.exif ? parseExif(metadata.exif) : {};
    delete exif.GPS; // GPS IFD 제거
    return pipeline.withExif(exif).toBuffer();
  }

  // 'none' — 원본 그대로
  return buffer;
}

export type ExifStripPolicy = 'all' | 'gps_only' | 'none';
```

#### R2 prefix

```
원본: user/{userId}/moments/{momentId}/{photoId}.{ext}
strip: user/{userId}/moments/{momentId}/stripped/{photoId}_{policy}.{ext}
```

#### Share 연동 (ADR-0014)

`Share` entity에 `exifStripped` boolean — 공유 시 strip 파일 가리킴.

### 모바일 (`apps/mobile/`)

- 공유 옵션 UI: 라디오 — "GPS 제거 (기본)" / "모든 메타 제거" / "원본 그대로"
- Moment 단위 default 정책 설정 화면 (Phase 3 5.3)

### 메모리 트리거 활성화

`picker-exif-preservation-revisit` — Phase 3 진입 = 트리거 활성. 학습 노트 보강 시점에 능동 알림:

- Android picker GPS Ref 손실 (Phase 2 4.6 발견)
- 실 사용자 EXIF 손실 보고 (운영 진입 후)
- picker upgrade 시점 (Expo SDK 메이저 업그레이드 시)

## 재검토 트리거

- **특수 메타 처리 필요** — XMP/IPTC/ICC profile 처리 필요 시 exiftool spawn 검토
- **strip 정밀도 보고** — 실 사용자가 "strip 후에도 GPS 남음" 보고 시 exiftool 비교
- **메타 보존 옵션 확장** — "날짜만 제거 / 디바이스만 제거" 등 세부 옵션 — sharp의 withExif 깊이 활용 vs exiftool

## 참고

- [sharp — withMetadata / withExif](https://sharp.pixelplumbing.com/api-output#withmetadata)
- [exiftool — strip GPS](https://exiftool.org/forum/index.php?topic=11401.0)
- [Phase 3 Spec](../specs/phase-03-sharing.md) — 4.3 EXIF strip AC
- [exif-and-photo-metadata 학습 노트](../learnings/exif-and-photo-metadata.md) — Phase 2 4.5 EXIF 읽기 학습
