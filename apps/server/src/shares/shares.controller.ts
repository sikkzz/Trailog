// SharesController — 공유 링크 도메인 HTTP 표면 (Phase 3 5.1).
//
// 학습 포인트:
// - 인증 보호 endpoint만 — 외부 사용자 접근(GET /:token + unlock)은 D6 SSR wave에 추가
// - @CurrentUser로 본인 user 박제 + service 단 owner 검사 일관 (Moments/Photos 패턴)
// - DELETE /shares/:id — 204 No Content (RestResponse<null> wrapping 일관)

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestResponse } from '../common';
import type { User } from '../users/user.entity';

import { CreateShareRequestDto, CreateShareResponseDto } from './dtos/create-share.dto';
import { GetMySharesResponseDto } from './dtos/get-my-shares.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@Controller('shares')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  /** POST /shares — 공유 링크 생성 (본인 소유 target 검증) */
  @Post()
  @ApiOperation({
    summary: '공유 링크 생성',
    description:
      '본인 사진/Moment에 대한 공유 링크 생성. 만료/비밀번호/EXIF strip 정책 옵션. 토큰은 nanoid 21자.',
  })
  @ApiOkResponse({ description: '성공 — 공유 링크', type: CreateShareResponseDto })
  async createShare(
    @CurrentUser() user: User,
    @Body() dto: CreateShareRequestDto,
  ): Promise<RestResponse<CreateShareResponseDto>> {
    return this.sharesService.createShare(user.id, dto);
  }

  /** GET /shares — 본인 활성 공유 목록 (만료 제외, createdAt DESC) */
  @Get()
  @ApiOperation({
    summary: '본인 활성 공유 목록',
    description: '본인이 만든 공유 링크 중 만료되지 않은 것만. 최근 생성 순.',
  })
  @ApiOkResponse({ description: '성공 — 공유 배열', type: GetMySharesResponseDto })
  async findMyShares(@CurrentUser() user: User): Promise<RestResponse<GetMySharesResponseDto>> {
    return this.sharesService.findMyShares(user.id);
  }

  /** DELETE /shares/:id — 공유 취소 (DB row 삭제, 즉시 무효화) */
  @Delete(':id')
  @ApiOperation({
    summary: '공유 취소',
    description: 'DB row 삭제로 즉시 무효화 — 외부 접근자도 즉시 404.',
  })
  @ApiOkResponse({ description: '성공 — 취소 완료' })
  async deleteShare(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) shareId: string,
  ): Promise<RestResponse<null>> {
    return this.sharesService.deleteShare(user.id, shareId);
  }
}
