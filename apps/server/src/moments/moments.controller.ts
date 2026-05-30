// MomentsController — Moment 도메인 HTTP 표면.
//
// 학습 포인트:
// - 모든 endpoint는 JwtAuthGuard 보호 + @CurrentUser로 본인 user 박제.
// - @ApiBearerAuth('access-token') — Swagger UI에서 token 입력 UI 노출.
// - Service가 RestResponse 반환 → controller는 그대로 위임.

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestResponse } from '../common';
import type { User } from '../users/user.entity';

import { CreateMomentRequestDto, CreateMomentResponseDto } from './dtos/create-moment.dto';
import { GetMomentsResponseDto } from './dtos/get-moments.dto';
import { MomentsService } from './moments.service';

@ApiTags('moments')
@Controller('moments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class MomentsController {
  constructor(private readonly momentsService: MomentsService) {}

  /** POST /moments — 본인 moment 생성 */
  @Post()
  @ApiOperation({
    summary: '순간 만들기',
    description: '본인 moment 생성 — 여행/일상/단발 무관. 시작/종료일은 선택.',
  })
  @ApiOkResponse({ description: '성공 — 생성된 moment', type: CreateMomentResponseDto })
  async createMoment(
    @CurrentUser() user: User,
    @Body() dto: CreateMomentRequestDto,
  ): Promise<RestResponse<CreateMomentResponseDto>> {
    return this.momentsService.createMoment(user.id, dto);
  }

  /** GET /moments — 본인 moment 리스트 (createdAt DESC) */
  @Get()
  @ApiOperation({
    summary: '본인 순간 리스트',
    description: '본인의 moment 리스트 (최근 생성 순). Phase 후속 페이지네이션 도입 검토.',
  })
  @ApiOkResponse({ description: '성공 — moment 배열', type: GetMomentsResponseDto })
  async findMyMoments(@CurrentUser() user: User): Promise<RestResponse<GetMomentsResponseDto>> {
    return this.momentsService.findMomentsByUserId(user.id);
  }
}
