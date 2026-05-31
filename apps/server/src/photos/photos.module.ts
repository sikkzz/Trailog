// PhotosModule — Photo 도메인 모듈.
//
// 의존성:
// - TypeOrmModule.forFeature([Photo]) — Photo Repository
// - AuthModule — JwtAuthGuard
// - MomentsModule — Moment 권한 검증 (findMomentByIdAndUserId)
// - R2Module — R2Service (presigned URL 발급)
// - BullModule.forRootAsync + registerQueue — sharp 썸네일 + EXIF 작업 큐 (4.4+)
//
// BullModule 위치 결정 (참조 패턴 채택):
// - 현재 BullMQ 사용 도메인이 Photos 단일 — forRoot도 PhotosModule에 박음.
// - 응집도 ↑ + 다른 도메인 모듈에 BullModule 누수 X.
// - 미래 다른 도메인(이메일/알림) BullMQ 도입 시 → AppModule 또는 공통 InfraModule로
//   리팩토링 (메모리 `bullmq-domain-vs-root-revisit`).
//
// Queue 이름은 PHOTO_PROCESSING_QUEUE 상수로 분리 (오타 방지 + IDE 자동완성).

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MomentsModule } from '../moments/moments.module';
import { R2Module } from '../r2/r2.module';

import { PhotoProcessingProcessor } from './photo-processing.processor';
import { Photo } from './photo.entity';
import { PHOTO_PROCESSING_QUEUE } from './photos.constants';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo]),
    AuthModule,
    MomentsModule,
    R2Module,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          // ioredis는 URL 문자열 직접 파싱 — host/port/password 분리 불필요
          url: configService.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
    BullModule.registerQueue({ name: PHOTO_PROCESSING_QUEUE }),
  ],
  providers: [PhotosService, PhotoProcessingProcessor],
  controllers: [PhotosController],
  exports: [PhotosService],
})
export class PhotosModule {}
