// GeocodingController — 좌표 → 한국어 주소 HTTP 표면.
//
// Endpoint:
// - GET /geocode/reverse?lat=&lng=
//   → 도로명(우선) 또는 지번(fallback) 한국어 주소 반환. 한국 외/결과 X는 null.
//
// JwtAuthGuard 보호 — 좌표 자체는 sensitive X이지만 본인 사진 위치만 호출 의도 + 일관성.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestResponse } from '../common';

import { ReverseGeocodeQueryDto, ReverseGeocodeResponseDto } from './dtos/reverse-geocode.dto';
import { GeocodingService } from './geocoding.service';

@ApiTags('geocoding')
@Controller('geocode')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  /** GET /geocode/reverse?lat=&lng= — 좌표 → 한국어 주소 */
  @Get('reverse')
  @ApiOperation({
    summary: '좌표 → 한국어 주소 (NCP Reverse Geocoding)',
    description:
      '도로명 주소 우선, 지번 주소 fallback. 한국 외/결과 없으면 address=null. OS별 차이 통일 + 한국어 보장.',
  })
  @ApiOkResponse({ description: '성공', type: ReverseGeocodeResponseDto })
  async reverseGeocode(
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<RestResponse<ReverseGeocodeResponseDto>> {
    return this.geocodingService.reverseGeocode(query.lat, query.lng);
  }
}
