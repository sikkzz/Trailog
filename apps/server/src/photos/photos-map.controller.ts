// PhotosMapController — 지도 viewport 기반 사진 조회 HTTP 표면.
//
// Route prefix: `photos` (Moment scope 깨는 글로벌 photos endpoint).
// 기존 `PhotosController` (`moments/:momentId/photos`)와 분리 — 미래 GET /photos/:id 등
// 글로벌 photo endpoint 확장 자연.
//
// Endpoint:
// - GET /photos/map?bbox=minLng,minLat,maxLng,maxLat
//   → viewport 안 본인 사진 (location IS NOT NULL + processingStatus=done) 반환
//   → Phase 2 4.7 D3a — PostGIS ST_Within + ST_MakeEnvelope 자연 검증

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestResponse } from '../common';
import type { User } from '../users/user.entity';

import { GetMapPhotosQueryDto, GetMapPhotosResponseDto } from './dtos/get-map-photos.dto';
import { PhotosService } from './photos.service';

@ApiTags('photos')
@Controller('photos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PhotosMapController {
  constructor(private readonly photosService: PhotosService) {}

  /** GET /photos/map?bbox=... — 지도 viewport 본인 사진. */
  @Get('map')
  @ApiOperation({
    summary: '지도 viewport 안 본인 사진',
    description:
      'bbox(CSV 4 float) 안 본인 사진을 PostGIS ST_Within으로 필터. processingStatus=done만, takenAt DESC.',
  })
  @ApiOkResponse({ description: '성공 — photo 배열', type: GetMapPhotosResponseDto })
  async findPhotosByBbox(
    @CurrentUser() user: User,
    @Query() query: GetMapPhotosQueryDto,
  ): Promise<RestResponse<GetMapPhotosResponseDto>> {
    return this.photosService.findPhotosByBbox(user.id, query.bbox);
  }
}
