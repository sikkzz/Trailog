// Photo 엔티티 — Moment에 속한 사진 1장.
//
// Phase 2 4.3 진입 시점 초안 (feature-first incremental schema):
// - id, momentId FK, userId FK denorm, originalKey, timestamps
// - ON DELETE CASCADE — Moment / User 삭제 시 자동 cleanup
//
// 컬럼 결정:
// - originalKey: R2 객체 key만 저장 (full URL X). R2 → S3 마이그레이션 자유 + presigned 매번 발급
//   key 형식: `user/{userId}/moments/{momentId}/{photoId}.{ext}`
// - userId denorm: 권한 체크 빠르게 (moment 거치지 않고 본인 사진 직접 조회)
//
// Phase 후속 추가 예상:
// - 4.4 sharp: thumbnailUrls jsonb + processingStatus enum
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

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'moment_id', type: 'uuid' })
  momentId!: string;

  @ManyToOne(() => Moment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moment_id' })
  moment!: Moment;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // R2 객체 key — 사용자별 prefix 강제: user/{userId}/moments/{momentId}/{photoId}.{ext}
  @Column({ name: 'original_key', type: 'varchar', length: 512 })
  originalKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
