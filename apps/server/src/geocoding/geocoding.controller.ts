// GeocodingController — 좌표 → 한국어 주소 HTTP 표면.
//
// Endpoint:
// - GET /geocode/reverse?lat=&lng=  (인증 — 모바일)
// - GET /geocode/public/reverse?lat=&lng=  (인증 X — Web 공유 페이지)
//   둘 다 같은 service 호출. Phase 3 5.1 D6c에서 Web AddressLabel용 public 추가.
//
// 좌표 자체는 sensitive X — public endpoint OK. NCP API 비용은 동일.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestResponse } from '../common';

import { ReverseGeocodeQueryDto, ReverseGeocodeResponseDto } from './dtos/reverse-geocode.dto';
import { GeocodingService } from './geocoding.service';

@ApiTags('geocoding')
@Controller('geocode')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  /** GET /geocode/reverse?lat=&lng= — 인증 필요 (모바일) */
  @Get('reverse')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '좌표 → 한국어 주소 (인증)',
    description:
      '도로명 주소 우선, 지번 주소 fallback. 한국 외/결과 없으면 address=null. OS별 차이 통일 + 한국어 보장.',
  })
  @ApiOkResponse({ description: '성공', type: ReverseGeocodeResponseDto })
  async reverseGeocode(
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<RestResponse<ReverseGeocodeResponseDto>> {
    return this.geocodingService.reverseGeocode(query.lat, query.lng);
  }

  /** GET /geocode/public/reverse?lat=&lng= — 인증 X (Web 공유 페이지 — Phase 3 5.1 D6c) */
  @Get('public/reverse')
  @ApiOperation({
    summary: '좌표 → 한국어 주소 (인증 X — 공유 페이지용)',
    description: 'Web 공유 페이지(/s/:token)에서 외부 사용자가 호출. 좌표는 sensitive X.',
  })
  @ApiOkResponse({ description: '성공', type: ReverseGeocodeResponseDto })
  async reverseGeocodePublic(
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<RestResponse<ReverseGeocodeResponseDto>> {
    return this.geocodingService.reverseGeocode(query.lat, query.lng);
  }
}
