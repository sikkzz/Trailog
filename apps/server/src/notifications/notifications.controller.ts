// SSE endpoint — 인증된 사용자가 자기 알림만 받음.
//
// 클라이언트 흐름:
//   const es = new EventSource(`${API_URL}/notifications/stream`, {
//     headers: { Authorization: `Bearer ${token}` }
//   });
//   es.onmessage = (e) => { const payload = JSON.parse(e.data); ... }
//
// 연결 끊김 감지: RxJS `finalize()` operator — 참조 코드(blaybus sse.controller.ts) 채택.
// finalize는 Observable 완료/에러/unsubscribe 모두 캐치. `req.on('close')`보다 정직.

import { Controller, Logger, Sse, UseGuards, type MessageEvent } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { finalize, Observable } from 'rxjs';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/user.entity';

import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications/stream — SSE 연결.
   *
   * 응답 헤더: `Content-Type: text/event-stream` (NestJS 자동).
   * 각 알림은 `data: <json>\n\n` 형식.
   * 클라이언트(EventSource)가 자동 재연결 처리 (끊김 시 lastEventId + retry).
   */
  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'SSE 알림 stream',
    description:
      '인증된 사용자 본인의 알림만 수신. type 분기: photo.processed / share.viewed. 연결 끊김 시 cleanup.',
  })
  stream(@CurrentUser() user: User): Observable<MessageEvent> {
    const channel = this.notificationsService.getOrCreateChannel(user.id);

    return channel.asObservable().pipe(
      finalize(() => {
        this.logger.log(`SSE 연결 끊김: ${user.id}`);
        this.notificationsService.cleanup(user.id);
      }),
    );
  }
}
