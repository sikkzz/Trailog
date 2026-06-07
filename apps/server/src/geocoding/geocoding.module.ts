// GeocodingModule — 좌표 → 주소 (NCP API proxy).
//
// 의존성:
// - AuthModule (JwtAuthGuard)
// - ConfigModule (이미 global — NCP_CLIENT_ID/SECRET 주입)
//
// 단순 lookup 도메인 — DB 의존 X, 외부 NCP API만 호출.

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';

@Module({
  imports: [AuthModule],
  controllers: [GeocodingController],
  providers: [GeocodingService],
})
export class GeocodingModule {}
