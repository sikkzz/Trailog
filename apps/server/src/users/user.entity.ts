// User 엔티티 — 인증의 가장 기본.
//
// Phase 2 4.1 (인증) 진입을 위한 최소 형태:
// - id: uuid (URL/로그에 노출돼도 안전, 추측 어려움)
// - email: 로그인 식별자. unique 인덱스.
// - password: bcrypt hash 저장 (raw 비밀번호 절대 X). select: false 로 기본 조회에서 제외.
// - createdAt/updatedAt: 감사용. @CreateDateColumn/@UpdateDateColumn이 자동 갱신.
//
// Phase 2 후속에서 추가 예상:
// - displayName, avatarUrl, lastLoginAt, deletedAt (soft delete)
// - Trip[] 관계 (@OneToMany)

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users', comment: '사용자 — 인증 + Moment/Photo 소유자' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // email 검증은 DTO/class-validator로 별도 처리. DB는 unique만 보장.
  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 255,
    comment: '로그인 식별자 이메일 (unique). 형식 검증은 DTO 레이어',
  })
  email!: string;

  @Column({
    type: 'varchar',
    length: 255,
    select: false,
    comment: 'bcrypt hash 저장 (raw 비밀번호 금지). select:false로 기본 조회 제외',
  })
  password!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
