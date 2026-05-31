// PhotosModule — Photo 도메인 모듈.
//
// 의존성:
// - TypeOrmModule.forFeature([Photo]) — Photo Repository
// - AuthModule — JwtAuthGuard
// - MomentsModule — Moment 권한 검증 (findMomentByIdAndUserId)
// - R2Module — R2Service (presigned URL 발급)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MomentsModule } from '../moments/moments.module';
import { R2Module } from '../r2/r2.module';

import { Photo } from './photo.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Photo]), AuthModule, MomentsModule, R2Module],
  providers: [PhotosService],
  controllers: [PhotosController],
  exports: [PhotosService],
})
export class PhotosModule {}
