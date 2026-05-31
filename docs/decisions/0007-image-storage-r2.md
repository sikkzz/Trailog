# ADR-0007: 이미지 저장소 — Cloudflare R2 (Phase 4 S3 전환 학습 박제)

> **상태**: Accepted
> **날짜**: 2026-05-31
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 2 Spec](../specs/phase-02-core-features.md) 4.3, [R2 presigned URL 학습 노트](../learnings/r2-presigned-url-basics.md)

---

## 맥락 (Context)

Trailog는 사진 + 위치를 박제하는 메모리 아카이브 앱. **사진 파일 저장소 + 다운로드 트래픽**이 본질적 인프라.
사진 앱은 다운로드 트래픽(egress) 비용이 폭증할 위험이 큼 — AWS S3 기준 egress가
GB당 $0.09 (첫 10TB), 사용자 1000명만 되어도 월 수백 달러 폭증 가능.

PROJECT_ROOT 결정 5(비용 최소화 전략)에서 이미 "Cloudflare R2 사용 — 무료 egress"가 잠정 결정되어 있었음.
Phase 2 4.3 진입 시점에 정식 ADR로 박제 + 대안 4종 비교 + 학습 박제 + Phase 4 S3 전환 학습 계획.

## 결정 (Decision)

**선택**: **Phase 2~3 (학습/베타) — Cloudflare R2**

**Phase 4 (AWS ECS 전환 시점) — S3 마이그레이션을 학습 + 실무 경험 박제 기회로 정식 박제**.
단순 "재검토 trigger"가 아니라 **의도된 학습 단계**.

## 이유 / 트레이드오프

### 얻는 것 (R2 채택)

- **egress 무료** — 사진 앱 트래픽 비용 폭증 차단 (최대 비용 리스크 제거)
- **10GB + 클래스 A 100만/월 + 클래스 B 1000만/월 무료 티어** — 초기 + 베타 충분
- **S3 호환 API** — `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` 그대로 사용. 학습 + Phase 4 마이그레이션 비용 최소
- **글로벌 anycast 네트워크** — 한국 사용자엔 도쿄/싱가포르 PoP 자동 라우팅. latency 양호
- **저장 비용 저렴** — $0.015/GB-월 (S3 표준 $0.023의 65%)
- **Cloudflare Workers 통합** (Phase 5+ 검토 옵션) — Worker에서 R2 직접 접근, edge에서 이미지 변환 등

### 포기하는 것 (S3 거부의 비용)

- **AWS 생태계 실무 경험 즉시 확보 X** — 채용 시 "S3 운영 경험" 인지도가 R2보다 높음. Phase 4에 보완.
- **한국 리전 부재** — Cloudflare는 region 개념 없이 anycast. 정밀 지역 분리(GDPR, 데이터 주권)가 필요한 도메인엔 부적합. Trailog는 무관 (학습 단계).
- **AWS lifecycle 자동화** (intelligent tiering, glacier 등) — 대량 데이터의 cold storage 자동 이동 기능 약함. 사이드 규모엔 무관.
- **CloudWatch 풍부한 모니터링** — Cloudflare 대시보드는 간소. 사이드 + 베타엔 충분.

### 학습 가치 관점

- **S3 호환 API 학습** — 어떤 저장소로 가도 그대로 적용. AWS S3 / Backblaze B2 / MinIO 다 동일 API
- **Presigned URL 패턴 정복** — 클라가 백엔드 안 거치고 직접 업로드/다운로드 (백엔드 트래픽 0). 모든 사진 앱의 표준 패턴
- **Signature V4 알고리즘** — AWS SDK가 자동 처리하지만 원리 이해 가치
- **Phase 4 R2 → S3 마이그레이션 자체가 학습** — `rclone` / AWS SDK migration script 작성 / lifecycle 정책 / CloudWatch 모니터링 셋업 모두 실무 직결 (아래 섹션 참고)

## 검토한 대안 — 10 항목 깊이 비교

### 1. 비용 — 가장 큰 결정 요인

| 항목                  | AWS S3                                    | Cloudflare R2                                              |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| 저장                  | $0.023/GB-월                              | $0.015/GB-월 (65%)                                         |
| **Egress (다운로드)** | **$0.09/GB** (첫 10TB)                    | **$0** (무제한 무료)                                       |
| PUT 요청              | $0.005/1000                               | Class A $4.50/M (=$0.0045/1000)                            |
| GET 요청              | $0.0004/1000                              | Class B $0.36/M (=$0.00036/1000)                           |
| 무료 티어             | 12개월만 (이후 0): 5GB + 20K GET + 2K PUT | **영구**: 10GB 저장 + 100만 Class A/월 + 1000만 Class B/월 |

#### 실제 시나리오 — 사용자 1000명, 평균 1000장 (사진 평균 5MB)

```
저장: 5 TB
  S3:  5000 GB × $0.023 = $115/월
  R2:  5000 GB × $0.015 = $75/월

다운로드 (사용자 매일 50장 봄 = 1000 × 50 × 30 × 5MB ≈ 7.5 TB/월):
  S3:  7500 GB × $0.09 = $675/월  ⚠️ 폭증
  R2:  $0  (egress 무료)

합계:
  S3:  ~$790/월 (≈ 100만원)
  R2:  ~$75/월 (≈ 10만원)
```

**R2가 10배 저렴**. PROJECT_ROOT 비용 가이드(상용 월 7~10만원)와 정확히 일치 (R2 채택 시).

### 2. API / 호환성

| 항목                  | S3                      | R2                            |
| --------------------- | ----------------------- | ----------------------------- |
| API 표준              | AWS S3 (사실상 표준)    | S3 호환 API                   |
| AWS SDK               | 그대로 사용             | 그대로 사용 (endpoint만 변경) |
| Region 개념           | 명시 (`ap-northeast-2`) | 없음 (`region: 'auto'`)       |
| Bucket Policies / ACL | 풍부                    | 일부 미지원 (대부분 안 씀)    |
| Multipart Upload      | ✅                      | ✅                            |

→ **`@aws-sdk/client-s3` 동일 코드**. endpoint URL만 다름.

### 3. 인프라 / 통합

| 항목                | S3                                                   | R2                                                    |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| 생태계              | AWS (Lambda, CloudFront, IAM, SNS, SQS 등 강한 통합) | Cloudflare (Workers, CDN, Pages — R2 자체에 CDN 내장) |
| Trailog 백엔드 영향 | NestJS on Fly.io — AWS 종속성 추가                   | Fly.io와 별개 — Cloudflare 가입만 추가                |
| CDN 별도 비용       | CloudFront 필요 (+$0.085/GB egress)                  | R2가 자체 CDN처럼 동작 (egress 무료에 포함)           |

### 4. 글로벌 Latency

| 항목                | S3                                       | R2                                                         |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| 한국 사용자 latency | ap-northeast-2 (서울 region) — 매우 빠름 | Cloudflare PoP 300+ — 한국/도쿄 PoP로 자동 라우팅, 수십 ms |
| 데이터 위치 제어    | 명시적 region                            | 자동 (Cloudflare 알아서)                                   |

실측: R2도 한국에서 빠름 (다른 사이드 프로젝트 측정 사례 일관). 한국 사용자 체감 차이 없음.

### 5. 신뢰성 / SLA

| 항목             | S3                      | R2                   |
| ---------------- | ----------------------- | -------------------- |
| Durability       | 99.999999999% (11 nine) | 99.999999999% (동일) |
| Availability SLA | 99.99%                  | 99.9%                |
| Production-grade | ✅                      | ✅                   |

S3가 SLA 약간 높음 (연간 다운타임 차이 ~8시간). 사이드 + 베타엔 무관.

### 6. 데이터 주권 / 컴플라이언스

| 항목         | S3                                      | R2                                                  |
| ------------ | --------------------------------------- | --------------------------------------------------- |
| Region 명시  | ✅ — GDPR/한국 PIPA 대응 명확           | 데이터 위치 정확 제어 X (현재 EU/US 우선 저장 약속) |
| Trailog 영향 | Phase 후속 정식 서비스 시점에 검토 가치 | 학습/베타 단계엔 무관                               |

### 7. 운영 도구 / 모니터링

| 항목        | S3                                     | R2                               |
| ----------- | -------------------------------------- | -------------------------------- |
| 모니터링    | CloudWatch 풍부                        | Cloudflare 대시보드 (간소)       |
| Lifecycle   | 풍부 (intelligent tiering, glacier 등) | 간단 (N일 후 삭제)               |
| Replication | Cross-region replication               | 현재 없음 (Phase 후속 발표 예정) |
| Versioning  | ✅                                     | 미지원                           |

사이드 규모엔 둘 다 충분. 운영 단계 진입 시 차이 발생.

### 8. 개발자 경험 / 학습

| 항목      | S3                                         | R2                           |
| --------- | ------------------------------------------ | ---------------------------- |
| 인지도    | 사실상 표준 (학습 토픽/채용에서 "S3 경험" 흔함) | 신생 (2022 GA), 알려지는 중  |
| 학습 깊이 | S3 호환 API — R2와 동일                    | "S3 호환" 명시하면 동급 어필 |
| AWS 시험  | AWS Certified에 다룸                       | X (Cloudflare 시험엔 다룸)   |

→ **학습 가치는 동등**. R2 = "S3 호환 API + Cloudflare 특화 학습". S3 자체 운영 경험은 Phase 4에서 본격.

### 9. 벤더 락인 / 마이그레이션

| 항목         | S3                                                             | R2                                      |
| ------------ | -------------------------------------------------------------- | --------------------------------------- |
| Lock-in      | 풍부한 기능 사용 시 강해짐 (lifecycle / replication / Glacier) | 기본 PUT/GET만 — lock-in 미약           |
| 마이그레이션 | S3 → R2 가능                                                   | R2 → S3 거의 free (`rclone` 한 줄 명령) |

→ **R2 → S3 마이그레이션 비용 거의 0**. Phase 4 AWS 전환 시점에 학습 단계로 정식 박제.

### 10. Phase 4 AWS ECS 전환 영향

PROJECT_ROOT 결정 — Phase 4에 백엔드 ECS Fargate 전환 예정.

- **R2 유지 옵션**: ECS + R2 (별개 시스템). Fly Postgres → Postgres 등 다른 외부 의존성과 동일 패턴
- **S3 전환 옵션**: ECS + S3 (AWS 통합 깔끔). 단 egress 비용 폭증 위험 — 운영 시점에 트래픽 측정 후 결정
- **하이브리드**: 원본 R2 (저장 + 다운로드) + 썸네일/캐시 S3 (AWS CDN과 통합) — 복잡

### 추가 검토 대안

| 대안                 | 장점                                                                               | 단점                                                                                         | 제외 이유                                            |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Supabase Storage** | PostgreSQL RLS 통합, S3 호환 API                                                   | 무료 1GB만(5GB egress), 50MB 파일 제한, Supabase 종속 (Trailog DB는 Fly Postgres 잠정 — Q11) | 무료 티어 작고 종속성 부담. DB와 별개 저장소가 깔끔  |
| **Backblaze B2**     | 가장 저렴 ($0.005/GB), S3 호환, Cloudflare Bandwidth Alliance(B2 → CF egress 무료) | 인지도 낮음, R2와 가격/기능 차이 미미                                                        | R2가 1st-party CF 통합이라 단순 + 학습 토픽 인지도 약간 ↑ |

## 결과 / 영향

### 구조 변경

- `apps/server/src/photos/` 도메인 (Phase 2 4.3 D4): R2 client 추가
  - `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` 의존성
  - `apps/server/src/photos/photos.service.ts`에 `createPresignedUploadUrl()` 메서드
- Fly secrets:
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- 모바일: presigned URL 받아 R2에 직접 `fetch PUT` 호출
- R2 버킷 정책: 공개 URL 비활성화 — 다운로드도 presigned URL로 (private 유지)

### 비용 영향

- 무료 티어 (10GB) 동안: 0원
- 초과 시: $0.015/GB-월 저장. egress는 영구 무료
- 베타(~100명, 사용자당 사진 1000장 평균 ~5GB 가정): 500GB → 월 $7.5
- 상용(~1000명, 평균 5GB 가정): 5TB → 월 $75 + egress 무료

### 보안 영향

- presigned URL 만료 5분 — 짧게 (탈취 시 영향 시간 제한)
- 사용자별 prefix (`user/{userId}/photos/{photoId}.{ext}`) — IAM 정책으로 cross-user 접근 차단
- bucket public access OFF — 모든 read도 presigned URL 거침

## Phase 4 S3 마이그레이션 학습 계획 (정식 박제)

**단순 재검토 trigger가 아니라 의도된 학습 단계**.

### 배경

S3는 실무에서 사실상 표준 (AWS 시험, 채용 공고 빈도 R2보다 압도적으로 높음). R2가 비용/학습 효율 우위라서 **Phase 2~3 채택**이지만, **S3 자체 운영 경험은 포트폴리오/학습 토픽에서 강한 시그널**이라 Phase 4 ECS 전환 시점에 같이 학습.

### 학습 의도

Phase 4 (AWS ECS 전환) 시점에 다음을 학습 + 박제:

1. **R2 → S3 마이그레이션 실무**
   - `rclone` 또는 AWS SDK 기반 migration script 작성
   - 단계별 cutover 전략 (dual-write → switch read → cleanup)
   - 데이터 무결성 검증 (체크섬, 카운트 비교)
   - 학습 노트 박제: `s3-migration-from-r2.md`

2. **S3 운영 도구 정복**
   - CloudWatch 메트릭 + Alarm 셋업
   - S3 Lifecycle Policy (intelligent tiering, archive)
   - S3 versioning + delete markers (실수 복구)
   - S3 Replication (cross-region 백업)
   - S3 Access Logs → Athena 분석

3. **AWS 비용 모니터링 + 최적화**
   - Cost Explorer로 egress/storage/request 분석
   - Reserved Capacity (Phase 4에 트래픽 안정화 시)
   - CloudFront 통합 (egress 비용 절감)
   - 학습 노트 박제: `s3-cost-optimization.md`

4. **AWS IAM + 보안 깊이**
   - IAM Role + ECS Task Role (presigned URL 발급)
   - S3 Bucket Policy + ACL (default deny)
   - VPC Endpoint (private 통신)
   - 학습 노트 박제: `aws-iam-and-s3-security.md`

### 전환 결정 기준 (Phase 4 시점)

R2 → S3 전환은 **자동 X**. Phase 4 진입 시 실측 후 결정:

- **트래픽 패턴 측정**: 실제 egress/저장 사용량 (R2 대시보드)
- **비용 시뮬레이션**: S3 + CloudFront vs R2 (위 시나리오 재계산)
- **운영 도구 필요성**: lifecycle / replication 등 R2 부족 기능이 정말 필요한지
- **학습 가치 vs 비용**: 마이그레이션 작업 + 운영 비용 증가 vs S3 실무 경험 가치

### 가능한 결정 시나리오

- **A. 전체 S3 전환** — R2 → S3 마이그레이션 + 운영. 비용 증가하지만 AWS 통합 + 실무 경험 정복.
- **B. 하이브리드** — 원본/대용량 사진은 R2 (egress 무료), 썸네일/캐시는 S3 + CloudFront (지연 시간/CDN 통합). 양쪽 학습.
- **C. R2 유지 + AWS 다른 서비스로 학습** — S3 미사용. EC2/Lambda/RDS 등 다른 AWS 서비스로 학습 보완.
- 추천 시점 — Phase 4 진입 직전에 ADR 재작성(`Superseded by ADR-XXXX`).

### 학습 노트 작성 시점

- Phase 4 진입 시점: `s3-migration-from-r2.md`, `s3-cost-optimization.md`, `aws-iam-and-s3-security.md`
- 포트폴리오 항목 가치: "Cloudflare R2 → AWS S3 마이그레이션 경험" — 실무 의사결정 + 마이그레이션 작업 모두 보유

## 재검토 트리거

- **Phase 4 AWS ECS 전환 시점** — 위 학습 계획 실행. 트래픽 + 비용 측정 후 A/B/C 결정.
- **사용자 1000+ 도달 + 운영 비용 검토** — R2 비용 모니터링, 한국 리전 도입 필요성 검토
- **이미지 처리 edge로 옮길 필요 발생** — Cloudflare Images 또는 R2 + Workers 검토 (현재는 NestJS sharp)
- **데이터 주권(GDPR/한국 PIPA) 요구** — 특정 리전 저장 필수가 되면 R2 → 리전별 저장소 검토

## 참고

- [Cloudflare R2 공식 문서](https://developers.cloudflare.com/r2/)
- [R2 vs S3 비교 (Cloudflare blog)](https://blog.cloudflare.com/r2-open-beta/)
- [Backblaze + Cloudflare Bandwidth Alliance](https://www.backblaze.com/blog/backblaze-and-cloudflare-partner-to-provide-free-data-transfer/)
- [AWS S3 가격 — 공식](https://aws.amazon.com/s3/pricing/)
- [R2 가격 — 공식](https://developers.cloudflare.com/r2/pricing/)
- [R2 presigned URL 학습 노트](../learnings/r2-presigned-url-basics.md) (Phase 2 4.3 D2)
- (Phase 4 작성 예정) S3 마이그레이션 학습 노트 3건
