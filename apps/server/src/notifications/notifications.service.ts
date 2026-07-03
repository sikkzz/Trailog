// 사용자별 SSE 채널 관리.
//
// 핵심 자료구조: Map<userId, Subject<MessageEvent>>
// - 각 user가 SSE 연결하면 Subject 1개 박힘 (이미 박혀있으면 재사용 X — 다중 연결 가능하게 별도 검토)
// - 다른 service가 publish(userId, event) 호출하면 해당 Subject.next() 트리거
// - 연결 끊기면 컨트롤러가 cleanup() 호출 → Subject complete + Map에서 제거
//
// **Phase 3 5.3 — in-memory only**:
// - 알림 영속성 X (휘발 — 연결 안 된 시점 알림은 못 받음)
// - 단일 서버 인스턴스 가정 (Fly.io scale=1)
// - Phase 4 운영 진입 시 Redis Pub/Sub + DB 영속화 검토 (메모리 `client-state-mgmt-revisit` 박힘 X — 추후 새 메모리)

import { Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';

/** 알림 페이로드 타입 — type discriminator로 모바일이 분기 처리. */
export type NotificationPayload =
  | { type: 'photo.processed'; photoId: string; status: 'done' | 'failed'; momentId: string }
  | { type: 'share.viewed'; shareId: string; target: 'photo' | 'moment'; targetId: string };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly channels = new Map<string, Subject<MessageEvent>>();

  /**
   * user의 SSE 채널 가져오기 (없으면 새로 박음).
   * Controller의 @Sse() 메서드에서 Observable로 변환해서 반환.
   */
  getOrCreateChannel(userId: string): Subject<MessageEvent> {
    let subject = this.channels.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.channels.set(userId, subject);
      this.logger.log(`SSE 채널 박힘: ${userId}`);
    }
    return subject;
  }

  /** 연결 끊김 시 호출 — Subject complete + Map에서 제거. */
  cleanup(userId: string): void {
    const subject = this.channels.get(userId);
    if (subject) {
      subject.complete();
      this.channels.delete(userId);
      this.logger.log(`SSE 채널 제거: ${userId}`);
    }
  }

  /**
   * 다른 service에서 호출 — 특정 user에게 알림 발행.
   * 연결 안 된 user면 silent (in-memory 휘발, 의도 정직).
   */
  publish(userId: string, payload: NotificationPayload): void {
    const subject = this.channels.get(userId);
    if (!subject) {
      this.logger.debug(`SSE 채널 X (skip): ${userId} ${payload.type}`);
      return;
    }
    subject.next({ data: payload });
  }
}
