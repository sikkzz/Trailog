# ADR-0002: 인프라 배포 전략 — 하이브리드 (PaaS 시작 → Phase 4에 AWS ECS 마이그레이션)

> **상태**: ✅ Accepted (확정 2026-05-24)
> **날짜**: 2026-05-24
> **결정자**: @sikkzz (제안: Claude)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [Docker 기초 + 실무 백엔드 패턴](../learnings/docker-basics-and-real-world-backend.md), [인프라 진화 + 개념 사전](../learnings/infra-evolution-and-key-concepts.md)
> **대체 / 보완**: PROJECT_ROOT.md 4장 "AWS 학습 전략" 의 원래 결정을 확장

---

## 맥락 (Context)

PROJECT_ROOT 4장 원안: 사이드 전 기간을 PaaS(Railway/Fly.io)로 운영하고, AWS는 LocalStack 또는 무료 티어로 별도 학습.

이 안의 trade-off:

- ✅ 학습 시간 절약 — 본진(이미지 파이프라인, 지도, 모바일)에 집중
- ✅ 비용 통제 명확
- ❌ AWS 직접 운영 경험 부족 → 실무 학습 시장에서 백엔드/인프라 시그널 약함
- ❌ 실무 환경(어쳐브모먼트, ECS Fargate 운영)와 환경 다름 → 실무 학습 직결도 ↓

논의 끝에 본인이 다음 우려를 제기:

> "사이드는 결국 실무·실무 학습·경험에 도움 되어야 하는데, 보편적 스택과 방향성으로 학습해야 하지 않나. 지금 진행하는 스택이 실무에서 일반적이지 않다."

실무 규모별 인프라 스택 확인 결과:

- 인디/시드~A 스타트업: PaaS(Railway/Fly.io/Vercel/Cloudflare)는 사실상 표준 ✅
- 시리즈 B+ / 실무 환경: AWS ECS/EKS 직접 운영
- 실무 학습 시장 (백엔드/DevOps): AWS 명시 비율 압도적

→ PaaS만으로는 본인 우려 완전 해소 불가. AWS 직접 경험 + 사이드 시간 부담을 균형 잡을 방법 필요.

## 결정 (Decision)

**선택**: ✅ **하이브리드 — Phase 1~3은 PaaS, Phase 4에 AWS ECS Fargate로 마이그레이션**

```
Phase 1~3 (약 3개월)
  ├─ Railway 또는 Fly.io (PaaS)
  ├─ 본진 학습 가속: 이미지 파이프라인, 지도, 인증, 모바일
  └─ 컨테이너/CI-CD/배포 기초 학습 (PaaS도 내부적으로 Docker)

Phase 4 (인프라 강화, 약 2~4주 +α)
  ├─ AWS ECS Fargate로 마이그레이션
  ├─ Terraform IaC, ECR, CloudWatch 학습
  └─ 실무 환경과 동일한 스택 경험 확보

Phase 5+ (이후)
  └─ AWS 위에서 운영 안정화, 실시간/캐싱/AI 추가
```

## 이유 / 트레이드오프

### 왜 하이브리드인가

1. **본인 우려에 직접 응답** — AWS 직접 운영 경험을 확보. 실무 학습 시그널 강화.
2. **실무 진화 패턴 그대로 재현** = 가장 강한 학습 스토리
   - 실무도 2024년 단계 1 (EC2+PM2) → 2026 Q1 단계 3 (ECS Fargate) 마이그레이션 경험
   - 본인이 Trailog에서 같은 진화 경험 → **학습 토픽에서 "왜 마이그레이션 했나" 풀어낼 수 있음**
3. **시간 분배 최적화**
   - Phase 1~3: PaaS로 본진 빠르게 → 학습 영역 6개 균형 유지
   - Phase 4: 인프라 마이그레이션 한 번에 본격 학습 → 깊이 있는 hands-on
4. **비용 통제 가능**
   - 사이드 트래픽 미미 → 최소 사양 ECS Fargate (0.25 vCPU, 0.5GB)
   - RDS db.t4g.micro + Single-AZ
   - 예상 월 $30~50 (측정 후 조정)
   - 비용 알람 필수

### 얻는 것

- **실무 학습 시그널 강화** — AWS ECS·Terraform·ECR·CloudWatch 직접 운영 경험
- **실무 학습 직결** — 본인 실무 환경 동일 스택 → 참조 코드 읽기·동료 대화 가속
- **마이그레이션 스토리** — "왜 PaaS에서 AWS로?"는 강력한 학습 토픽 토픽
- **분산 시스템/IaC 기초** — Terraform·CloudWatch·Secrets Manager 등 advanced 영역 입구

### 포기하는 것

- **Phase 4 시간 +2~4주** — 원래 2주 → 4~6주 (마이그레이션 작업)
- **월 $30~50 비용 발생** — Phase 4 시점부터 (그전에는 PaaS 무료 티어/저비용)
- **PaaS의 단순함** — git push 자동 배포 → ECS CI/CD 파이프라인 구성 필요
- **VPC/IAM/보안 그룹 학습 부담** — Phase 4에 모두 들어옴

### 학습 가치 관점

- **PROJECT_ROOT 학습 영역 1번 (인프라/DevOps) 완전 충족** + 추가로 AWS 특화 영역 채움
- **CI/CD, 컨테이너, 무중단 배포, 모니터링** → Phase 1~3 PaaS에서 기초, Phase 4 ECS에서 심화
- **사내 read-only 권한 + LocalStack** 등 보조 학습 트랙도 병행 가능

## 검토한 대안

| 대안 | 장점 | 단점 | 제외 이유 |
|------|------|------|----------|
| **A. PaaS 전체** (원안) | 시간 절약, 비용 ↓ | AWS 경험 부족, 실무 학습 시그널 약함 | 본인 우려 미해소 |
| **B. AWS ECS 처음부터** | 강한 시그널, 깊은 학습 | Phase 1 시간이 인프라에 매몰, 비용 폭탄 위험 | 학습 영역 6개 균형 깨짐 |
| **C. 하이브리드** ⭐ | 두 단계 학습, 시간/비용 균형, 마이그레이션 스토리 | Phase 4 부담 ↑ | (선택안) |
| **D. PaaS + 사내 read-only 보충** | 가장 가벼움, 실무 실 환경 보기 | hands-on 부족, 포트폴리오 효과 ↓ | hands-on이 약함 |
| **E. EC2 직접** | AWS 기초, 무료 티어 | 컨테이너 학습 X, 2026 비주류, 운영 부담 | 시대 흐름과 안 맞음 |

## 결과 / 영향

본 결정으로 인해 변경되는 사항:

### PROJECT_ROOT.md
- 4장 "인프라" 표: 백엔드 호스팅 부분에 Phase별 명시
- 4장 "AWS 학습 전략" 섹션: 단순 별도 학습 → 하이브리드 마이그레이션 전략으로 확장
- 6장 Phase 4 로드맵: "AWS ECS 마이그레이션" 작업 명시적 포함

### Phase 4 작업량 +2~4주
- Dockerfile 작성 (백엔드 production용, multi-stage)
- ECR repo 생성 + 이미지 push
- VPC + subnet + IGW + 보안 그룹 (간소화 셋업)
- ECS Cluster + Task Definition + Service
- ALB + Target Group + Route 53 + ACM 인증서
- CloudWatch Log Group + 비용 알람
- GitHub Actions CI/CD 파이프라인 (ECR push → ECS 업데이트)
- (선택) Terraform으로 위 모든 걸 IaC 화

### 후속 ADR 예정
- **ADR-0003**: PaaS 도구 정식 결정 (Railway vs Fly.io) — Phase 1 4.4 직전
- **ADR-0004**: AWS 마이그레이션 상세 계획 — Phase 4 진입 시 (구체 ECS launch type, VPC 구조 등)

### 비용 예상

| 시점 | 인프라 | 월 비용 (추정) |
|------|------|-----|
| Phase 1~3 | PaaS (Railway 또는 Fly.io 무료/저티어) | $0~10 |
| Phase 4 마이그레이션 후 | AWS ECS Fargate (최소 사양) + RDS Single-AZ | $30~50 |
| Phase 5+ 운영 안정화 | 위와 비슷, 트래픽에 따라 조정 | $30~80 |

비용 알람 필수 (CloudWatch Billing Alarm). 무료 티어 1년 활용 가능 (계정 신규 시).

## 재검토 트리거

다음 중 하나라도 발생하면 이 결정을 재검토:

- **Phase 4 진입 시점 (~3개월 후)**: 시간 여유, AWS 학습 욕심, 비용 부담 재평가
- **사이드 사용자가 의외로 많이 생김**: PaaS 비용이 ECS보다 비싸지면 마이그레이션 가속
- **실무 환경가 다른 클라우드(GCP, Azure)로 옮김**: 학습 방향 재조정
- **AWS 신규 가격 정책 변경**: 비용 폭탄 위험 ↑
- **PaaS 무료/저티어 정책 폐지** (Heroku처럼): 마이그레이션 가속

## 후속 작업

- [ ] PROJECT_ROOT 4장 + 6장 Phase 4 업데이트
- [ ] 학습 노트(`infra-evolution-and-key-concepts.md`) Part 3에 Phase별 전략 + 하이브리드 사유 명시
- [ ] Phase 1 4.4 직전: ADR-0003 (PaaS 도구 정식 결정)
- [ ] Phase 4 진입 시점: ADR-0004 (마이그레이션 상세) + 비용 알람 셋업
- [ ] (선택) AWS 무료 티어 계정 미리 생성 + 학습 트랙으로 LocalStack 활용

## 참고

- [PROJECT_ROOT 4장 AWS 학습 전략](../PROJECT_ROOT.md#4-기술-스택)
- [실무 진화 4단계 분석](../learnings/infra-evolution-and-key-concepts.md#part-1-운영-백엔드-인프라-진화--일반-4단계)
- [Railway 공식](https://railway.com)
- [Fly.io 공식](https://fly.io)
- [AWS ECS Fargate](https://aws.amazon.com/fargate/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
