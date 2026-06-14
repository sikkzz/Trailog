// PublicSharesController — 외부 사용자 read-only (Phase 3 5.1 D6b).
//
// 인증 X — token만으로 검증.
// 별도 controller로 분리한 사유:
//   - 인증 보호(@UseGuards) 있는 SharesController와 명확 분리
//   - `/shares/public/:token` 경로로 의도 명확
//   - 향후 SSR/CDN 최적화 시 별도 처리 자연
//
// 응답은 PublicShareResponseDto — status 'locked'/'open'으로 분기.

import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { PublicShareResponseDto, UnlockShareRequestDto } from './dtos/public-share.dto';
import { SharesService } from './shares.service';

@ApiTags('shares-public')
@Controller('shares/public')
export class PublicSharesController {
  constructor(private readonly sharesService: SharesService) {}

  /**
   * GET /shares/public/:token
   *   - 만료/취소: 410/404
   *   - 비밀번호 보호: status='locked' (사진 데이터 X)
   *   - 정상: status='open' + photo/moment
   */
  @Get(':token')
  @ApiOperation({
    summary: '공유 링크 외부 조회',
    description:
      'token으로 share 조회 — 비밀번호 보호 시 locked, 정상 시 open + 사진/Moment 데이터.',
  })
  @ApiOkResponse({
    description: '성공 — 공유 데이터 또는 locked 상태',
    type: PublicShareResponseDto,
  })
  async findPublicByToken(@Param('token') token: string): Promise<PublicShareResponseDto> {
    return this.sharesService.findPublicByToken(token);
  }

  /**
   * POST /shares/public/:token/unlock { password }
   *   - bcrypt 비교 → 통과 시 open 응답
   *   - 실패: 401
   */
  @Post(':token/unlock')
  @ApiOperation({
    summary: '비밀번호 보호 공유 unlock',
    description: 'bcrypt 비교 후 사진/Moment 데이터 응답.',
  })
  @ApiOkResponse({ description: '성공 — 공유 데이터', type: PublicShareResponseDto })
  async unlock(
    @Param('token') token: string,
    @Body() dto: UnlockShareRequestDto,
  ): Promise<PublicShareResponseDto> {
    return this.sharesService.unlockShare(token, dto.password);
  }

  /**
   * GET /shares/public/:token/download/:photoId — 백엔드 proxy 다운로드 (Phase 3 5.2 D5).
   *
   * 참조 admin-data-center.service.ts 패턴 일관:
   *   res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8''...');
   *   res.send(buffer);
   *
   * R2 CORS 우회 + 강제 다운로드 + 정직한 파일명 (한글 호환 RFC 5987).
   * strip 정책 적용 — Lazy 생성된 변형 파일 또는 원본.
   */
  @Get(':token/download/:photoId')
  @ApiOperation({
    summary: '공유 사진 다운로드 (백엔드 proxy)',
    description:
      'R2 CORS 우회 + Content-Disposition: attachment 강제 다운로드. strip 정책 자동 적용.',
  })
  async downloadPhoto(
    @Param('token') token: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, contentType } = await this.sharesService.getDownloadFile(
      token,
      photoId,
    );
    // RFC 5987 — 한글 파일명 지원 (filename* 박음)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }
}
