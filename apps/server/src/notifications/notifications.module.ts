// Notifications 모듈 — Phase 3 5.3 SSE 진입.
//
// 다른 모듈에서 NotificationsService 주입해서 publish() 호출:
//   - PhotosModule (photo-processing processor에서 완료/실패 알림)
//   - SharesModule (외부 조회 시 owner에게 알림)

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule], // JwtAuthGuard + CurrentUser 활용
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // 다른 모듈에서 주입용
})
export class NotificationsModule {}
