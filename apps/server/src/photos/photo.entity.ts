// Photo 엔티티 — Moment에 속한 사진 1장.
//
// Phase 2 4.3 진입 시점 초안 (feature-first incremental schema):
// - id, momentId FK, userId FK denorm, originalKey, timestamps
// - ON DELETE CASCADE — Moment / User 삭제 시 자동 cleanup
//
// Phase 2 4.4 D3a 보강:
// - thumbnailKeys jsonb NULL — sharp 처리 완료 시 {s, m, l: R2 key} 박힘
// - processingStatus varchar — 'pending' | 'done' | 'failed', DB default 'pending'
//
// 컬럼 결정:
// - originalKey: R2 객체 key만 저장 (full URL X). R2 → S3 마이그레이션 자유 + presigned 매번 발급
//   key 형식: `user/{userId}/moments/{momentId}/{photoId}.{ext}`
// - userId denorm: 권한 체크 빠르게 (moment 거치지 않고 본인 사진 직접 조회)
// - thumbnailKeys: URL이 아닌 Key 저장 (presigned URL은 매번 동적 발급, DB엔 영구 자산만)
// - processingStatus: PG enum X, varchar — enum 변경 시 마이그레이션 비싸고 NestJS 패턴 일관
//
// Phase 후속 추가 예상:
// - 4.5 EXIF: takenAt timestamptz + location geometry(Point, 4326) + exifJson

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Moment } from '../moments/moment.entity';
import { User } from '../users/user.entity';

import type { PhotoProcessingStatus, PhotoThumbnailKeys } from './photo-processing.types';

@Entity({ name: 'photos', comment: 'Moment에 속한 사진 1장 — 원본 R2 key + 썸네일 + 처리 상태' })
export class Photo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({
    name: 'moment_id',
    type: 'uuid',
    comment: '소속 Moment.id (FK, ON DELETE CASCADE)',
  })
  momentId!: string;

  @ManyToOne(() => Moment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moment_id' })
  moment!: Moment;

  @Index()
  @Column({
    name: 'user_id',
    type: 'uuid',
    comment: '소유자 User.id denorm — 권한 체크 빠르게 (FK, ON DELETE CASCADE)',
  })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'original_key',
    type: 'varchar',
    length: 512,
    comment: 'R2 객체 key — 형식: user/{userId}/moments/{momentId}/{photoId}.{ext}',
  })
  originalKey!: string;

  @Column({
    name: 'thumbnail_keys',
    type: 'jsonb',
    nullable: true,
    comment: 'sharp 완료 시 {s,m,l: R2 key} 박힘. 처리 전엔 NULL (Phase 2 4.4)',
  })
  thumbnailKeys!: PhotoThumbnailKeys | null;

  @Column({
    name: 'processing_status',
    type: 'varchar',
    length: 20,
    default: 'pending',
    comment: 'pending/done/failed — confirm 직후 pending, worker 종료 시 갱신 (Phase 2 4.4)',
  })
  processingStatus!: PhotoProcessingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
