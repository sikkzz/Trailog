// SharesModule — 공유 링크 도메인 (Phase 3 5.1).
//
// 책임:
// - Share entity 관리 (생성/조회/취소)
// - 외부 사용자 read-only 접근 (인증 X, 토큰만) — D6 SSR wave에 추가
// - 비밀번호 보호 시 unlock 흐름 — D6에 추가
//
// 의존:
// - MomentsModule.export(MomentsService) — Moment 권한 검증 (공유 생성 시 owner 검사)
// - PhotosModule.export(PhotosService) — Photo 권한 검증 + 외부 접근 시 사진 데이터 조회
// - bcrypt — 비밀번호 해시 (회원가입과 동일 cost factor)
// - nanoid — 토큰 생성 (ADR-0014)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MomentsModule } from '../moments/moments.module';
import { PhotosModule } from '../photos/photos.module';

import { Share } from './share.entity';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [TypeOrmModule.forFeature([Share]), MomentsModule, PhotosModule],
  providers: [SharesService],
  controllers: [SharesController],
  exports: [SharesService],
})
export class SharesModule {}
