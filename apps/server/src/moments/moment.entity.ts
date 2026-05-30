// Moment 엔티티 — 사진/장소/시간으로 박제된 한 단위의 순간.
//
// 도메인 정의: 여행/일상/단발 무관 — 사용자가 남기고 싶은 어떤 순간이든 박제.
// 예시:
//   - 도쿄 1주 여행 = 1 Moment (startedAt~endedAt 채움)
//   - 성수 카페 단발 방문 = 1 Moment (startedAt/endedAt null OK, title만)
//   - 퇴근 한강 산책 = 1 Moment (startedAt만 채우거나 둘 다)
//
// Phase 2 4.3 진입 시점 초안:
// - id, userId FK, title, startedAt/endedAt, timestamps
// - ON DELETE CASCADE — User 삭제 시 그 사용자의 moment도 자동 cleanup
//
// Phase 2 후속 추가 예상 (feature-first 점진):
// - 4.4: 변경 X (Photo 쪽 컬럼 보강)
// - 4.6 모바일 첫 화면: coverPhotoId? description? 화면 디자인에 맞춰 추가
// - 4.7 지도: 변경 X (Photo.location 활용)
// - Phase 3 공유: isPublic, shareCode 등

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

import { User } from '../users/user.entity';

@Entity('moments')
export class Moment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // FK 제약 + ON DELETE CASCADE — DB 무결성 강제 + 사용자 탈퇴 시 자동 cleanup
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // 순간 제목 — 자유 표현 ("도쿄 여행", "성수 ABC 카페", "퇴근 한강 산책" 등). 255자.
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  // 순간 시작/종료 (사용자 입력, 선택).
  // - 장기 여행: 둘 다 채움
  // - 단발 방문: 둘 다 null 또는 startedAt만
  // EXIF takenAt(Phase 2 4.5)과 별개 — 사용자 의도 표현.
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
