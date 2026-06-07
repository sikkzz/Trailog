import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthModule } from './health/health.module';
import { MomentsModule } from './moments/moments.module';
import { PhotosModule } from './photos/photos.module';
import { UsersModule } from './users/users.module';

// BullMQ 위치: PhotosModule에 박혀있음 (참조 패턴 — 도메인 모듈 응집).
// 미래 BullMQ 사용 도메인 추가 시 AppModule 또는 공통 InfraModule로 리팩토링.
// (메모리 `bullmq-domain-vs-root-revisit` 참고)

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    MomentsModule,
    PhotosModule,
    GeocodingModule,
  ],
})
export class AppModule {}
