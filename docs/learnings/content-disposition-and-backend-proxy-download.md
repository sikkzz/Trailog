# Content-Disposition과 백엔드 proxy 다운로드 패턴

> **작성일**: 2026-07-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #1 인프라 (HTTP 세부) + #2 이미지/미디어 배포
> **관련 문서**: [Phase 3 Spec 4.2](../specs/phase-03-sharing.md), [r2-presigned-url-basics.md](./r2-presigned-url-basics.md)

---

## 한 줄 요약

**Content-Disposition: attachment + RFC 5987 UTF-8 인코딩 = 브라우저가 강제 다운로드 + 한글 파일명 정직 처리**. `<a href download>`는 same-origin 정책 하에만 attribute 활용, cross-origin은 서버 응답 헤더가 결정. 백엔드 proxy 패턴은 R2 CORS 우회 + 파일명 제어 + Content-Type 정직 + 강제 다운로드 3가지 통합. Trailog Phase 3 5.2 D5 채택.

## 우리 프로젝트에서 어디에 쓰이는가

- **Phase 3 5.2 D5** — 공유 페이지 사진 다운로드 버튼
- 백엔드 `apps/server/src/shares/public-shares.controller.ts`
  - `GET /shares/public/:token/download/:photoId` — 백엔드가 R2에서 buffer fetch 후 attachment로 stream
- Web `apps/web/src/app/s/[token]/DownloadButton.tsx`
  - `<a href={downloadUrl} download>` — 백엔드 URL 그대로 활용

## 배경 — 왜 백엔드 proxy 채택했나

### 원안 — R2 presigned URL 직접 활용

```typescript
// Web에서 R2 presigned URL 그대로 활용
<a href={presignedGetUrl} download="사진.jpg">다운로드</a>
```

**시도 1 — CORS 실패**:

```
Access to fetch at 'https://r2.cloudflarestorage.com/...' from origin 'https://trailog.app'
has been blocked by CORS policy
```

**시도 2 — R2 dashboard CORS rule 박음**:

```json
[{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] }]
```

- OPTIONS preflight OK, actual GET **여전히 403 Forbidden**
- 이유: Origin 헤더 박힌 GET 요청은 R2 SigV4와 CORS 검증 순서/충돌 이슈

**시도 3 — AWS SDK v3.700+ integrity protections 비활성**:

```typescript
new S3Client({
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

- SDK가 자동으로 박던 `X-Amz-Checksum-Mode=ENABLED` 제거
- **SDK 직접 호출은 OK, presigned URL은 여전히 403**
- 서명 계산 시점과 실제 요청 시점의 헤더 mismatch

**결론**: R2 cross-origin GET 자체가 근본 문제. **참조 admin-data-center 패턴 채택** — 백엔드가 파일 스트림 + 강제 다운로드.

### 백엔드 proxy 패턴 (참조 admin-data-center 일관)

```typescript
// apps/server/src/shares/public-shares.controller.ts
@Get(':token/download/:photoId')
async downloadPhoto(@Param('token') token, @Param('photoId') photoId, @Res() res: Response) {
  const { buffer, filename, contentType } = await this.sharesService.getDownloadFile(token, photoId);

  res.setHeader('Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', buffer.length.toString());
  res.send(buffer);
}
```

**얻는 것**:

- R2 CORS 무관 (백엔드 ↔ R2는 same-server 통신)
- 파일명 제어 (`trailog-abc12345.jpeg`)
- Content-Type 정직 (extension에서 mime 매핑)
- **강제 다운로드** (attachment)
- EXIF strip 정책 적용 후 stream (Lazy 캐싱과 자연 통합)

**포기**:

- 백엔드 대역폭 소비 (R2에서 fetch → 클라이언트로 stream 2배)
- 스트리밍 처리 안 하면 메모리 스파이크 (Trailog 현재 buffer 전체 로드)

## Content-Disposition 헤더 정직 해석

### 기본 형식

```
Content-Disposition: attachment; filename="photo.jpg"
```

- `attachment`: 브라우저에게 **다운로드 강제** (inline 표시 X)
- `filename`: 저장 시 default 파일명

### `inline` vs `attachment`

```
Content-Disposition: inline; filename="photo.jpg"
→ 브라우저가 처리 가능하면 표시 (이미지는 렌더, PDF는 뷰어)

Content-Disposition: attachment; filename="photo.jpg"
→ 다운로드 대화상자 강제
```

**Trailog**: `attachment` 선택. 사용자가 클릭하면 저장.

### 한글 파일명 함정 — 왜 RFC 5987 필요한가

**❌ 나쁜 예 1 — 그냥 한글 박음**:

```
Content-Disposition: attachment; filename="여행사진.jpg"
```

- HTTP 헤더는 **ASCII만 표준 (RFC 7230)**
- 한글 그대로 박으면 브라우저별 해석 랜덤 (Chrome은 UTF-8, 일부 IE/Safari는 Latin-1)
- 파일명 깨짐 (`?????.jpg` 또는 `¿¿¿¿.jpg`)

**❌ 나쁜 예 2 — URL 인코딩만**:

```
Content-Disposition: attachment; filename="%EC%97%AC%ED%96%89%EC%82%AC%EC%A7%84.jpg"
```

- 일부 브라우저(Safari)가 인코딩된 상태 그대로 저장 → `%EC%97%AC...jpg` 파일명

**✅ RFC 5987 정직 방식**:

```
Content-Disposition: attachment; filename*=UTF-8''%EC%97%AC%ED%96%89%EC%82%AC%EC%A7%84.jpg
                                          ^^^^^^^^^
                                          encoding''encoded-value
```

- `filename*=` (별표 활용) — 확장 파라미터
- 형식: `charset'language'encoded-value`
- `UTF-8''` — UTF-8 encoding, language 생략
- 브라우저가 charset 정보 활용해 정확 디코딩

**Trailog 실제 활용**:

```typescript
res.setHeader(
  'Content-Disposition',
  `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
);
```

**참고**: 표준적으론 `filename="fallback"` + `filename*=UTF-8''encoded` 둘 다 박는 게 안전 (구형 브라우저 fallback). Trailog는 모던 브라우저만 대상이라 `filename*=`만 활용.

## HTML `<a download>` attribute — same-origin 제약

```html
<a href="https://cdn.example.com/photo.jpg" download="my-photo.jpg">다운로드</a>
```

- HTML5 `download` attribute — 브라우저에게 "다운로드해라 + 이 이름으로" hint
- **same-origin 하에서만 파일명 override 가능**
- **cross-origin이면 download attribute 자체는 활용되지만 filename은 서버 응답 헤더가 결정**

### Trailog 실제 흐름

```html
<!-- Web 3000, 백엔드 4000 → cross-origin 이지만 백엔드가 Content-Disposition 박음 -->
<a href="http://localhost:4000/shares/public/{token}/download/{photoId}" download> 단말 저장 </a>
```

- `download` attribute — 브라우저에게 "download intent" 힌트 (일부 브라우저 UI 개선)
- 실제 파일명 → 백엔드 응답의 `Content-Disposition: attachment; filename*=UTF-8''...`
- **cross-origin 인데도 됨** — 백엔드 헤더가 결정

### 왜 fetch + blob URL 폐기했나

**초기 시도** (Phase 3 5.2 초기):

```typescript
async function downloadPhoto(url: string, filename: string) {
  const res = await fetch(url); // ❌ R2 CORS 실패
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
```

**문제**:

- CORS 통과 필수 (R2 실패)
- 전체 blob 메모리에 로드 (큰 파일은 부담)
- 코드 복잡

**정정** — 단순 `<a href download>` + 백엔드가 다 처리:

```typescript
<a href={downloadUrl} download>단말 저장</a>
```

- 브라우저 native 처리
- 스트리밍 (전체 메모리 X)
- CORS 무관 (백엔드가 same-origin에서 R2 fetch)

## 백엔드 proxy 흐름 다이어그램

```
브라우저             웹 (Vercel)          백엔드 (Fly)         R2
   │                    │                    │                 │
   │  GET /s/{token}    │                    │                 │
   ├───────────────────>│                    │                 │
   │                    │  fetch share       │                 │
   │                    ├───────────────────>│                 │
   │  <html>...         │  share JSON        │                 │
   │<───────────────────┤<───────────────────┤                 │
   │  DownloadButton    │                    │                 │
   │  render            │                    │                 │
   │                    │                    │                 │
   │  Click <a download>│                    │                 │
   │  GET /shares/public/{token}/download/{photoId}            │
   ├─────────────────────────────────────────>│                 │
   │                                          │  R2 GET (stripped)│
   │                                          ├────────────────>│
   │                                          │  file buffer    │
   │                                          │<────────────────┤
   │  Content-Disposition: attachment; filename*=UTF-8''trailog-abc.jpeg
   │  Content-Type: image/jpeg               │                 │
   │  Content-Length: 218053                 │                 │
   │  <binary>                               │                 │
   │<─────────────────────────────────────────┤                 │
   │  Browser 저장 대화상자 (trailog-abc.jpeg)                    │
```

## 참조 admin-data-center 패턴 정직 정리

**참조 코드 (blaybus admin-data-center.service.ts)**:

```typescript
async downloadDataCenterFile(fileId: number, res: Response): Promise<void> {
  const file = await this.fileRepo.findOneOrFail({ where: { id: fileId } });
  const buffer = await this.s3Service.getObjectBuffer(file.s3Key);

  res.setHeader('Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', buffer.length.toString());
  res.send(buffer);
}
```

**Trailog 채택** — 같은 패턴 그대로:

- `Content-Disposition: attachment; filename*=UTF-8''...`
- `Content-Type: <mime>`
- `Content-Length: <bytes>`
- `res.send(buffer)`

**차이**:

- 참조는 S3, Trailog는 R2 (S3 호환)
- 참조는 원본 파일명 (사용자 업로드명 활용), Trailog는 서버 생성 (`trailog-{photoId 8자}.jpeg`)
- 참조는 인증 필수 (관리자 페이지), Trailog는 token만 (외부 공유)

## 스트리밍 vs Buffer 로드 정직 비교

### Trailog 현재 — Buffer 전체 로드

```typescript
const buffer = await this.r2Service.getObjectBuffer(strippedKey);
res.send(buffer); // 전체 메모리에 로드 후 한 번에
```

**적합 케이스**:

- 파일 크기 작음 (~수 MB 사진)
- 백엔드 memory 여유 있음 (Fly.io 256MB에도 사진 몇 개 문제 X)
- 구현 단순

**부적합 케이스**:

- 큰 파일 (수 GB 비디오)
- 동시 다운로드 많음 (memory 스파이크)

### Streaming 방식 (미채택 — Phase 후속 고려)

```typescript
import { Readable } from 'stream';
const stream = await this.r2Service.getObjectStream(strippedKey);
stream.pipe(res); // R2 → 백엔드 → 클라이언트 스트림
```

**장점**: 메모리 상수 사용
**단점**: 구현 복잡 (에러 처리, backpressure), Content-Length 미리 알기 어려움

**Trailog 결정**: 현재 사진 크기 작아 buffer로 충분. Phase 4+ 비디오/큰 파일 지원 시 streaming으로 전환.

## AWS SDK v3.700+ integrity protections 문제

### 증상

```typescript
// AWS SDK v3.700+ default 활용
const url = await getSignedUrl(s3Client, new GetObjectCommand({ ... }), { expiresIn: 3600 });
// → 생성된 URL에 X-Amz-Checksum-Mode=ENABLED query param 자동 박힘

// 클라이언트 GET → 403 Forbidden
```

### 원인

- AWS SDK v3.700부터 "Default integrity protections" 도입
- 자동으로 checksum-related query param 추가
- **R2는 이 파라미터를 SigV4 서명 검증에 포함하지 않음** → mismatch → 403

### 해결

```typescript
new S3Client({
  requestChecksumCalculation: 'WHEN_REQUIRED', // default: WHEN_SUPPORTED (자동 박음)
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

**Trailog 실제**: `apps/server/src/r2/r2.module.ts`에 박음. presigned URL과 SDK 직접 호출 둘 다 안정.

**참고**: 백엔드 proxy 패턴 채택 후엔 presigned URL 활용 X. 다만 다른 시나리오 (모바일 → R2 직접 GET 등) 대비 설정 유지.

## 함정 (10종)

### 1. `filename=` vs `filename*=` 혼동

```typescript
// ❌ ASCII만 안전
`attachment; filename="${encodeURIComponent(name)}"` // 브라우저에서 인코딩된 상태 저장
// ✅ RFC 5987
`attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
```

### 2. `filename=` 안의 `""` 처리

파일명에 `"` 박혀있으면 escape 필요:

```typescript
const safe = name.replace(/"/g, '\\"');
res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
```

Trailog는 서버 생성 파일명이라 `"` 못 들어감 → 문제 X.

### 3. Content-Length 누락 시 chunked encoding

Content-Length 없으면 HTTP/1.1은 chunked, HTTP/2는 stream. 다운로드 진행률 표시 안 됨 (브라우저가 총 크기 모름). **정직하게 박기**:

```typescript
res.setHeader('Content-Length', buffer.length.toString());
```

### 4. `res.send()` vs `res.end()`

- `res.send(buffer)` — Express 편의 (Content-Length 자동 설정)
- `res.end(buffer)` — Node native

Trailog는 NestJS라 자체 wrap → `res.send()` 안전.

### 5. Content-Type 잘못 박기

MIME type 오해석 → 브라우저가 다르게 처리:

```typescript
// ❌
res.setHeader('Content-Type', 'application/octet-stream'); // 항상 다운로드
res.setHeader('Content-Type', 'image/jpg'); // 정식 X (image/jpeg 정직)

// ✅
const extToMime = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};
res.setHeader('Content-Type', extToMime[ext] ?? 'application/octet-stream');
```

### 6. Same-origin 없이 `download` filename override 시도

```html
<!-- cross-origin이면 download="name.jpg" 은 hint일 뿐, 서버 Content-Disposition이 우선 -->
<a href="https://other.com/file" download="renamed.jpg"></a>
```

브라우저가 서버 filename 그대로 씀. **cross-origin은 서버 응답 헤더로 제어**.

### 7. CORS preflight OPTIONS 응답에도 헤더 박아야 함

```typescript
// OPTIONS 처리 시
res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
```

- default로 CORS는 simple headers만 클라이언트에 노출
- Content-Disposition 접근 원하면 (JS로 파싱 필요 시) expose 필요

Trailog는 `<a download>` 방식이라 JS 접근 필요 X → 문제 X.

### 8. React Native `<a>` 다운로드 X

RN엔 HTML `<a>` 없음. 모바일 다운로드는 다른 흐름:

- `expo-file-system.downloadAsync(url, dest)` — 백엔드 URL에서 파일 다운로드
- `MediaLibrary.saveToLibraryAsync(uri)` — 사진첩 저장

Trailog Phase 3은 웹 사이드에서만 다운로드 (모바일은 sharing sheet). Phase 후속 모바일 다운로드 시 검토.

### 9. Blob URL 메모리 누수

`URL.createObjectURL(blob)` 활용 후 반드시 `revokeObjectURL()`:

```typescript
const url = URL.createObjectURL(blob);
a.click();
setTimeout(() => URL.revokeObjectURL(url), 100); // ~0.5초 뒤 revoke
```

Trailog는 `<a href download>` 채택으로 이 함정 자체 회피.

### 10. 백엔드 proxy 대역폭 계산

- R2 egress 무료 (Cloudflare)
- 백엔드 → 클라이언트 egress = **Fly.io 트래픽에 계산**
- Trailog Phase 1~3 hobby plan 무료 한도 OK
- **Phase 4 ECS 마이그레이션 시 대역폭 비용 산정 필요** (특히 사진 앱은 다운로드 활발)

## Trailog 결정 흐름 (Phase 3 5.2 D5)

1. **원안** — R2 presigned URL 직접 활용, `<a href download>` 로 클라 다운로드
2. **CORS 실패** — Origin 박힌 GET 403 (R2 SigV4 vs CORS 상호작용)
3. **CORS rule 추가** — dashboard `*` 허용 → 여전히 실패
4. **AWS SDK checksum 비활성** — 도움되지만 근본 해결 X
5. **참조 admin-data-center 패턴 채택** — 백엔드 proxy + Content-Disposition + attachment
6. **`<a href download>` 로 단순화** — fetch/blob 폐기

**학습 자산**:

- Content-Disposition 헤더 정직 이해 (RFC 5987 한글 처리)
- HTML `<a download>` cross-origin 제약
- CORS + Signed URL 상호작용 함정
- 백엔드 proxy 패턴의 4가지 통합 가치 (CORS 우회 + 파일명 + Content-Type + 강제)

## Phase 후속 정복 항목

- **Streaming 다운로드** — 큰 파일(비디오) 지원 시 buffer → stream 전환
- **다운로드 진행률 표시** — Content-Length 활용 fetch 진행률 (블랙박스 다운로드가 아닌 UI)
- **여러 파일 zip 다운로드** — Moment 전체 다운로드 요청 시 `archiver` 로 zip 스트림
- **Signed URL + short-lived cache** — 백엔드 proxy 부담 완화 대안 (R2 CORS 이슈 해결 시)
- **CDN 최적화** — Cloudflare Workers로 same-origin 캐싱 처리 (Phase 5+)

## 참고 링크

- [RFC 6266 — Content-Disposition](https://datatracker.ietf.org/doc/html/rfc6266)
- [RFC 5987 — Character Set and Language Encoding for HTTP Header Field Parameters](https://datatracker.ietf.org/doc/html/rfc5987)
- [MDN — Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
- [MDN — HTMLAnchorElement.download](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download)
- [AWS SDK v3 Default Integrity Protections](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html)
- [r2-presigned-url-basics.md — R2 기본](./r2-presigned-url-basics.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
