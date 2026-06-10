// Share 엔티티 — 공유 링크 토큰 (Phase 3 5.1).
//
// 도메인: 본인이 박제한 사진/Moment를 외부 사람에게 read-only로 보여주는 토큰.
// 토큰 자체는 nanoid 21자 (URL-safe, ADR-0014). DB row 삭제로 즉시 무효화.
//
// 핵심 트레이드오프 (ADR-0014):
// - DB 조회 1회 필수 (JWT처럼 stateless X) — share 접근은 hot path X라 무시 가능
// - 즉시 취소 가능 — owner가 "공유 취소" 누르면 row 삭제 또는 revoked flag
// - 만료/비밀번호/EXIF 정책 모두 DB row에 박힘 (단순 데이터 모델)
//
// Phase 2 4.3 기존 패턴 일관 (feature-first incremental schema 메모리):
// - 5.1 진입 초안 — id/token/owner_id/target/target_id/expires_at/password_hash/created_at
// - 5.2 진입 시 추가 예상 — exif_strip_policy enum (현재 5.1은 placeholder 컬럼만)
// - 5.3 SSE 진입 시 추가 예상 — view_count 또는 last_viewed_at (공유 조회됨 알림용)
// - Phase 4 운영 시점 — revoked boolean (즉시 무효화 시 row 삭제 대신 flag)
//
// **참조 패턴 비교 — Trailog 채택 사유**:
// 참조 백엔드(실무)는 외부 공유 도메인 없음 — 직접 비교 패턴 X. 단 OAuth refresh
// token 영구 저장 패턴(`refresh_tokens` table + user_id + token_hash + expires_at)과
// 구조 유사. 차이: refresh token은 인증 후 발급(user_id 필수), share는 외부 read-only
// (인증 X 접근). 본 entity는 OAuth refresh token 패턴 + 만료/비밀번호 추가.
//
// **polymorphic target/target_id**:
// type-safe TypeORM 관계 X — service 단에서 target enum 분기로 photo/moment 조회.
// 단점: FK 제약 못 박음 (photo.id와 moment.id가 같은 uuid 공간). 단순함 ↑ 채택.
// 대안 (Phase 후속 검토): photo_share / moment_share 별도 table (관계 명확).

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../users/user.entity';

export enum ShareTarget {
  PHOTO = 'photo',
  MOMENT = 'moment',
}

/**
 * EXIF strip 정책 — 5.1엔 placeholder만, 5.2 wave에서 본격 활용.
 * - all: 모든 EXIF 제거 (sharp default 동작)
 * - gps_only: GPS 키만 제거 + 나머지 보존 (사용자 친화 기본값)
 * - none: 원본 그대로 (사용자 명시 선택)
 */
export enum ExifStripPolicy {
  ALL = 'all',
  GPS_ONLY = 'gps_only',
  NONE = 'none',
}

@Entity({
  name: 'shares',
  comment: '공유 링크 토큰 — 외부 read-only 접근',
})
export class Share {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 21,
    comment: 'nanoid 21자 토큰 — URL path (/s/{token})에 노출, UNIQUE',
  })
  token!: string;

  @Index()
  @Column({
    name: 'owner_id',
    type: 'uuid',
    comment: '공유 생성자 User.id (FK, ON DELETE CASCADE) — 본인 활성 공유 목록 조회용',
  })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({
    type: 'enum',
    enum: ShareTarget,
    comment: '공유 대상 종류 — photo(단일 사진) 또는 moment(Moment 전체)',
  })
  target!: ShareTarget;

  @Column({
    name: 'target_id',
    type: 'uuid',
    comment: 'target=photo면 photo.id, target=moment면 moment.id (polymorphic, FK 제약 X)',
  })
  targetId!: string;

  @Index()
  @Column({
    name: 'expires_at',
    type: 'timestamptz',
    nullable: true,
    comment: '만료 시각 — null = 영구. 인덱스로 cleanup cron job 활용 (Phase 4)',
  })
  expiresAt!: Date | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 60,
    nullable: true,
    comment: 'bcrypt hash (60자 고정) — 비밀번호 보호 옵션. null = 비밀번호 X',
  })
  passwordHash!: string | null;

  @Column({
    name: 'exif_strip_policy',
    type: 'enum',
    enum: ExifStripPolicy,
    default: ExifStripPolicy.GPS_ONLY,
    comment: 'EXIF strip 정책 — 5.2 wave에서 본격 활용. 5.1은 컬럼만 저장',
  })
  exifStripPolicy!: ExifStripPolicy;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
