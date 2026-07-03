// SharesService — 공유 링크 도메인 비즈니스 로직 (Phase 3 5.1).
//
// 책임:
// - createShare(userId, dto): 본인 소유 target 검증 + nanoid 토큰 발급 + DB row 생성
// - findMyShares(userId): 본인 활성 공유 목록 (만료 제외)
// - deleteShare(userId, shareId): owner 검사 후 DB row 삭제 (즉시 무효화)
//
// 외부 접근(GET /shares/:token / unlock)은 D6 SSR wave에 추가.
//
// 학습 포인트:
// - nanoid 21자 — ADR-0014 (URL-safe + 126 bit entropy + 충돌 안전)
// - bcrypt 10 rounds — 비밀번호 해시 (회원가입과 동일 cost factor)
// - target 권한 검증 — service 단계에서 분기 (photo/moment). polymorphic의 FK 제약 X 단점 보완.
// - 응답에 password_hash 노출 X — hasPassword boolean만

import {
  ConflictException,
  GoneException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { LessThan, MoreThan, Repository, type FindOptionsWhere } from 'typeorm';

import { RestResponse } from '../common';
import { MomentsService } from '../moments/moments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PhotosService } from '../photos/photos.service';

import { CreateShareRequestDto, CreateShareResponseDto } from './dtos/create-share.dto';
import { GetMySharesResponseDto, ShareListItemDto } from './dtos/get-my-shares.dto';
import { PublicMomentDto, PublicPhotoDto, PublicShareResponseDto } from './dtos/public-share.dto';
import { ExifStripPolicy, Share, ShareTarget } from './share.entity';

/** bcrypt cost factor — 회원가입(auth.service)과 동일하게 유지 */
const BCRYPT_ROUNDS = 10;

/** nanoid 토큰 길이 — ADR-0014 (21자, default) */
const TOKEN_LENGTH = 21;

/**
 * share.viewed 알림 throttle 간격 (ms).
 * 같은 share에 대해 이 간격 내 반복 조회는 알림 발행 X — owner 스팸 방지.
 * 5분 = 짧은 방문 세션 안에서 반복 조회를 자연스럽게 묶음.
 * Phase 4 다중 인스턴스 환경에선 Redis SETEX로 이전 (메모리 sse-phase4-enhancements-revisit).
 */
const SHARE_VIEWED_THROTTLE_MS = 5 * 60 * 1000;

@Injectable()
export class SharesService {
  /** 마지막 share.viewed 발행 시각 — shareId → epoch ms. in-memory 휘발 (단일 인스턴스 가정) */
  private readonly lastViewedEmit = new Map<string, number>();

  constructor(
    @InjectRepository(Share)
    private readonly shareRepo: Repository<Share>,
    private readonly momentsService: MomentsService,
    private readonly photosService: PhotosService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 본인 소유 target 검증 → 토큰 발급 → DB 저장.
   *
   * target 분기:
   *   - photo: PhotosService.findPhotoByIdAndUserId — 본인 사진만 공유 가능
   *   - moment: MomentsService.findMomentByIdAndUserId — 본인 moment만 공유 가능
   *
   * 권한 X → NotFoundException(404). 다른 사용자의 자원 노출 방지 (403 대신 404로 존재 자체 숨김).
   */
  async createShare(
    userId: string,
    dto: CreateShareRequestDto,
  ): Promise<RestResponse<CreateShareResponseDto>> {
    await this.assertTargetOwnership(userId, dto.target, dto.targetId);

    const token = await this.generateUniqueToken();
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : null;

    const entity = this.shareRepo.create({
      token,
      ownerId: userId,
      target: dto.target,
      targetId: dto.targetId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      passwordHash,
      exifStripPolicy: dto.exifStripPolicy ?? ExifStripPolicy.GPS_ONLY,
    });
    const saved = await this.shareRepo.save(entity);

    return new RestResponse<CreateShareResponseDto>().success(this.toResponseDto(saved), {
      status: HttpStatus.CREATED,
    });
  }

  /**
   * 본인 활성 공유 목록.
   * - 만료(expires_at < NOW())된 공유는 제외 — 사용자에겐 active만 보임
   * - 정렬: createdAt DESC (최근 생성 순)
   */
  async findMyShares(userId: string): Promise<RestResponse<GetMySharesResponseDto>> {
    const now = new Date();
    // expiresAt null OR expiresAt > now — 두 조건을 OR로
    // TypeORM where 배열 = OR 조합
    const whereActive: FindOptionsWhere<Share>[] = [
      { ownerId: userId, expiresAt: undefined },
      { ownerId: userId, expiresAt: MoreThan(now) },
    ];
    // expires_at IS NULL은 undefined로 안 잡힘 — raw로 보완
    const shares = await this.shareRepo
      .createQueryBuilder('s')
      .where('s.owner_id = :ownerId', { ownerId: userId })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .orderBy('s.created_at', 'DESC')
      .getMany();

    // 변수 사용 마킹 (위 FindOptionsWhere는 향후 단순 패턴 확장용 박제)
    void whereActive;
    void LessThan;

    return new RestResponse<GetMySharesResponseDto>().success({
      shares: shares.map((share) => this.toListItemDto(share)),
    });
  }

  /**
   * 공유 취소 — owner 검사 후 DB row 삭제 (즉시 무효화).
   *
   * 다른 사용자의 share를 삭제 시도 시 NotFoundException(404) — 존재 자체 숨김.
   */
  async deleteShare(userId: string, shareId: string): Promise<RestResponse<null>> {
    const share = await this.shareRepo.findOne({ where: { id: shareId, ownerId: userId } });
    if (!share) {
      throw new NotFoundException('공유 링크를 찾을 수 없습니다');
    }

    await this.shareRepo.delete(share.id);

    return new RestResponse<null>().success(null);
  }

  /**
   * 외부 사용자 접근 — token으로 share 조회 (Phase 3 5.1 D6b).
   *
   * 흐름:
   *   1. token으로 share row 조회 — 없으면 NotFound(404)
   *   2. 만료 검사 — 만료됐으면 Gone(410)
   *   3. 비밀번호 보호 시 → `{ status: 'locked' }` 응답 (사진 데이터 X)
   *   4. 정상 시 → target 분기로 photo/moment 데이터 + presigned URL
   *
   * **응답에 passwordHash 노출 X**. EXIF strip 정책은 5.1엔 metadata만 (실제 strip은 5.2 wave).
   *
   * @param token nanoid 21자 토큰
   */
  async findPublicByToken(token: string): Promise<PublicShareResponseDto> {
    const share = await this.findActiveShareOrThrow(token);

    // 비밀번호 보호 → locked 응답 (데이터 X). 실제 조회 X → viewed 발행 X
    if (share.passwordHash !== null) {
      return this.buildLockedResponse(share);
    }

    this.emitViewedIfNeeded(share);
    return this.buildOpenResponse(share);
  }

  /**
   * 외부 사용자 다운로드 — Phase 3 5.2 D5.
   *
   * Token 검증 + photoId가 share 범위에 속하는지 + strip 정책 적용 후 R2 buffer 반환.
   * Controller가 Content-Disposition 헤더 박고 buffer.send → 강제 다운로드.
   *
   * R2 CORS 우회 (참조 admin-data-center 패턴 일관) — 백엔드가 R2 GET + 클라이언트에
   * stream. 비밀번호 보호 share라도 본 endpoint 자체는 token만으로 검증.
   * 외부 사용자가 unlock 후 받은 downloadUrl을 활용 가정.
   *
   * @throws NotFoundException 토큰/사진 없음 또는 share 범위 밖
   * @throws GoneException 만료
   */
  async getDownloadFile(
    token: string,
    photoId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const share = await this.findActiveShareOrThrow(token);

    // photoId가 share 범위 내인지 검증
    if (share.target === ShareTarget.PHOTO) {
      if (share.targetId !== photoId) {
        throw new NotFoundException('사진을 찾을 수 없습니다');
      }
    } else {
      // ShareTarget.MOMENT — photo가 그 moment 안에 있는지
      const photo = await this.photosService.findPhotoByIdAndUserId(photoId, share.ownerId);
      if (!photo || photo.momentId !== share.targetId) {
        throw new NotFoundException('사진을 찾을 수 없습니다');
      }
    }

    // strip 정책 적용 — 5.2 흐름 그대로 (Lazy 생성 + R2 캐싱)
    const variant = this.policyToVariant(share.exifStripPolicy);
    const result = await this.photosService.findPhotoForShare(photoId, variant);
    if (!result) {
      throw new NotFoundException('사진을 찾을 수 없습니다');
    }

    // imageUrl이 가리키는 R2 key를 다시 추출 — 또는 PhotosService에서 key 직접 받아야
    // findPhotoForShare가 key 안 노출 → 별도 helper 호출 또는 직접 buffer 발급 필요
    // 단순 — PhotosService에 download buffer 신규 메서드 또는 R2 직접 호출
    const buffer = await this.photosService.getShareImageBuffer(photoId, variant);
    if (!buffer) {
      throw new NotFoundException('사진을 찾을 수 없습니다');
    }

    const ext = this.extractExt(result.photo.originalKey);
    const contentType = this.extToMime(ext);
    const filename = `trailog-${photoId.slice(0, 8)}.${ext}`;

    return { buffer, filename, contentType };
  }

  /** R2 key의 마지막 확장자 추출 — 소문자 */
  private extractExt(key: string): string {
    const dot = key.lastIndexOf('.');
    return dot === -1 ? 'jpg' : key.slice(dot + 1).toLowerCase();
  }

  /** 확장자 → MIME type (다운로드 응답 헤더용) */
  private extToMime(ext: string): string {
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      webp: 'image/webp',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  /**
   * 비밀번호 보호 share unlock — bcrypt 비교 후 정상 응답.
   *
   * 실패: UnauthorizedException(401).
   */
  async unlockShare(token: string, password: string): Promise<PublicShareResponseDto> {
    const share = await this.findActiveShareOrThrow(token);

    if (share.passwordHash === null) {
      // 비밀번호 안 박힌 share에 unlock 시도 → 일반 조회와 같음
      this.emitViewedIfNeeded(share);
      return this.buildOpenResponse(share);
    }

    const matched = await bcrypt.compare(password, share.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('비밀번호가 올바르지 않습니다');
    }

    this.emitViewedIfNeeded(share);
    return this.buildOpenResponse(share);
  }

  /**
   * share.viewed 알림 발행 — 5분 throttle. 같은 share 반복 조회는 owner 스팸이 되므로
   * 마지막 발행 후 SHARE_VIEWED_THROTTLE_MS 안엔 skip.
   *
   * in-memory Map — 단일 인스턴스 가정. Phase 4 ECS 이동 시 Redis SETEX로 이전.
   */
  private emitViewedIfNeeded(share: Share): void {
    const now = Date.now();
    const last = this.lastViewedEmit.get(share.id);
    if (last && now - last < SHARE_VIEWED_THROTTLE_MS) {
      return;
    }
    this.lastViewedEmit.set(share.id, now);
    this.notificationsService.publish(share.ownerId, {
      type: 'share.viewed',
      shareId: share.id,
      target: share.target,
      targetId: share.targetId,
    });
  }

  // ============================================================================
  // private
  // ============================================================================

  /** token 활성 share 조회 + 만료/존재 검사 */
  private async findActiveShareOrThrow(token: string): Promise<Share> {
    const share = await this.shareRepo.findOne({ where: { token } });
    if (!share) {
      throw new NotFoundException('공유 링크를 찾을 수 없습니다');
    }

    if (share.expiresAt !== null && share.expiresAt < new Date()) {
      throw new GoneException('공유 링크가 만료되었습니다');
    }

    return share;
  }

  /** 비밀번호 보호 — 사진 데이터 X 응답 */
  private buildLockedResponse(share: Share): PublicShareResponseDto {
    return {
      status: 'locked',
      target: share.target,
      exifStripPolicy: share.exifStripPolicy,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      photo: null,
      moment: null,
    };
  }

  /**
   * 정상 — target 분기로 photo/moment 데이터 응답.
   *
   * **5.2 변경**: share.exifStripPolicy를 strip variant로 변환해서 PhotosService에 전달.
   * - policy 'none' → variant null (원본/thumbnail 활용 — 5.1 패턴)
   * - policy 'all' → variant 'all' (Lazy strip)
   * - policy 'gps_only' → variant 'gps_only' (Lazy strip)
   */
  private async buildOpenResponse(share: Share): Promise<PublicShareResponseDto> {
    const variant = this.policyToVariant(share.exifStripPolicy);

    if (share.target === ShareTarget.PHOTO) {
      const result = await this.photosService.findPhotoForShare(share.targetId, variant);
      if (!result) {
        throw new NotFoundException('사진을 찾을 수 없습니다');
      }
      return {
        status: 'open',
        target: share.target,
        exifStripPolicy: share.exifStripPolicy,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        photo: this.toPublicPhotoDto(
          result.photo,
          result.imageUrl,
          share.exifStripPolicy,
          share.token,
        ),
        moment: null,
      };
    }

    // ShareTarget.MOMENT
    const moment = await this.momentsService.findMomentForShare(share.targetId);
    if (!moment) {
      throw new NotFoundException('Moment를 찾을 수 없습니다');
    }
    const photos = await this.photosService.findPhotosForMomentShare(share.targetId, variant);

    return {
      status: 'open',
      target: share.target,
      exifStripPolicy: share.exifStripPolicy,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      photo: null,
      moment: {
        id: moment.id,
        title: moment.title,
        startedAt: moment.startedAt?.toISOString() ?? null,
        endedAt: moment.endedAt?.toISOString() ?? null,
        photos: photos.map((p) =>
          this.toPublicPhotoDto(p.photo, p.imageUrl, share.exifStripPolicy, share.token),
        ),
      } satisfies PublicMomentDto,
    };
  }

  /**
   * EXIF strip 정책 → PhotosService variant.
   * 'none'은 strip 파일 X — null 반환해 원본/thumbnail 활용.
   */
  private policyToVariant(policy: ExifStripPolicy): 'all' | 'gps_only' | null {
    if (policy === ExifStripPolicy.NONE) return null;
    if (policy === ExifStripPolicy.ALL) return 'all';
    return 'gps_only';
  }

  /**
   * Photo entity → PublicPhotoDto.
   *
   * EXIF strip 정책 적용 (5.1엔 metadata만 — 실제 R2 strip 파일은 5.2 wave):
   * - all: location null (전체 EXIF strip 흉내)
   * - gps_only: location null (GPS만 제거)
   * - none: location 그대로
   *
   * 5.2 wave에서 R2 strip prefix 파일 활용으로 imageUrl 자체도 strip된 버전으로 변경.
   */
  private toPublicPhotoDto(
    photo: import('../photos/photo.entity').Photo,
    imageUrl: string,
    policy: ExifStripPolicy,
    token: string,
  ): PublicPhotoDto {
    const includeLocation = policy === ExifStripPolicy.NONE;
    return {
      id: photo.id,
      imageUrl,
      downloadUrl: this.buildDownloadUrl(token, photo.id),
      takenAt: photo.takenAt?.toISOString() ?? null,
      location:
        includeLocation && photo.location
          ? { latitude: photo.location.coordinates[1], longitude: photo.location.coordinates[0] }
          : null,
    };
  }

  /**
   * 백엔드 proxy 다운로드 URL — 외부 사용자 브라우저가 호출.
   * Content-Disposition: attachment 헤더로 강제 다운로드. R2 CORS 우회.
   * dev: http://localhost:4000 / 운영: BACKEND_PUBLIC_URL 환경변수.
   */
  private buildDownloadUrl(token: string, photoId: string): string {
    const base = process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:4000';
    return `${base}/shares/public/${token}/download/${photoId}`;
  }

  /** target이 본인 소유인지 검증 */
  private async assertTargetOwnership(
    userId: string,
    target: ShareTarget,
    targetId: string,
  ): Promise<void> {
    if (target === ShareTarget.PHOTO) {
      const photo = await this.photosService.findPhotoByIdAndUserId(targetId, userId);
      if (!photo) {
        throw new NotFoundException('사진을 찾을 수 없습니다');
      }
      return;
    }

    // ShareTarget.MOMENT
    const moment = await this.momentsService.findMomentByIdAndUserId(targetId, userId);
    if (!moment) {
      throw new NotFoundException('Moment를 찾을 수 없습니다');
    }
  }

  /**
   * 충돌 안전 nanoid 토큰 — UNIQUE 인덱스 충돌 발생 시 재시도 (확률 천만년에 1회).
   * 학습 박제: 21자 = 126 bit entropy = brute force 사실상 불가능 + 충돌도 무시할 수 있음.
   * 단 코드 안전을 위해 5회 재시도 후 에러 throw.
   */
  private async generateUniqueToken(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = nanoid(TOKEN_LENGTH);
      const existing = await this.shareRepo.findOne({ where: { token } });
      if (!existing) return token;
    }
    throw new ConflictException('공유 토큰 생성 실패 — 다시 시도해주세요');
  }

  /** Share entity → CreateShareResponseDto */
  private toResponseDto(share: Share): CreateShareResponseDto {
    return {
      id: share.id,
      token: share.token,
      shareUrl: this.buildShareUrl(share.token),
      target: share.target,
      targetId: share.targetId,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      hasPassword: share.passwordHash !== null,
      exifStripPolicy: share.exifStripPolicy,
      createdAt: share.createdAt.toISOString(),
    };
  }

  /** Share entity → ShareListItemDto (shape 동일) */
  private toListItemDto(share: Share): ShareListItemDto {
    return this.toResponseDto(share);
  }

  /**
   * 공유 URL 생성 — `SHARE_BASE_URL` 환경변수 + token.
   * 기본값: 'http://localhost:3000/s' (로컬 dev).
   * 운영: 'https://trailog.app/s' (Phase 4 도메인 연결 시점).
   */
  private buildShareUrl(token: string): string {
    const base = process.env.SHARE_BASE_URL ?? 'http://localhost:3000/s';
    return `${base}/${token}`;
  }
}
