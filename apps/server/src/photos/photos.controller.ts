// PhotosController — Photo 도메인 HTTP 표면.
//
// Route prefix: `moments/:momentId/photos` (REST + 도메인 hierarchy 명확).
//
// Endpoints:
// - POST /moments/:momentId/photos/upload-url → presigned PUT URL 발급
// - POST /moments/:momentId/photos            → 업로드 완료 알림 (Photo row 생성)
// - GET  /moments/:momentId/photos            → Moment의 사진 리스트

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestResponse } from '../common';
import type { User } from '../users/user.entity';

import { ConfirmPhotoRequestDto, ConfirmPhotoResponseDto } from './dtos/confirm-photo.dto';
import {
  CreateUploadUrlRequestDto,
  CreateUploadUrlResponseDto,
} from './dtos/create-upload-url.dto';
import { GetPhotosResponseDto } from './dtos/get-photos.dto';
import { PhotosService } from './photos.service';

@ApiTags('photos')
@Controller('moments/:momentId/photos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'momentId', description: 'Moment uuid', example: 'a1b2c3d4-...' })
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /** POST /moments/:momentId/photos/upload-url — presigned PUT URL 발급 */
  @Post('upload-url')
  @ApiOperation({
    summary: '사진 업로드 URL 발급',
    description: 'R2에 직접 PUT할 presigned URL 발급 (5분 만료) + photoId/key 생성',
  })
  @ApiOkResponse({ description: '성공', type: CreateUploadUrlResponseDto })
  async createPhotoUploadUrl(
    @CurrentUser() user: User,
    @Param('momentId', ParseUUIDPipe) momentId: string,
    @Body() dto: CreateUploadUrlRequestDto,
  ): Promise<RestResponse<CreateUploadUrlResponseDto>> {
    return this.photosService.createPresignedUploadUrl(user.id, momentId, dto);
  }

  /** POST /moments/:momentId/photos — 업로드 완료 알림 + Photo row 생성 */
  @Post()
  @ApiOperation({
    summary: '사진 업로드 완료 알림',
    description: 'R2 PUT 성공 후 호출 — Photo row 생성',
  })
  @ApiOkResponse({ description: '성공 — 생성된 photo', type: ConfirmPhotoResponseDto })
  async confirmPhotoUpload(
    @CurrentUser() user: User,
    @Param('momentId', ParseUUIDPipe) momentId: string,
    @Body() dto: ConfirmPhotoRequestDto,
  ): Promise<RestResponse<ConfirmPhotoResponseDto>> {
    return this.photosService.confirmPhotoUpload(user.id, momentId, dto);
  }

  /** GET /moments/:momentId/photos — Moment의 사진 리스트 */
  @Get()
  @ApiOperation({
    summary: 'Moment의 사진 리스트',
    description: '사진 배열 + 각 사진에 presigned GET URL 동봉 (1시간 만료)',
  })
  @ApiOkResponse({ description: '성공 — photo 배열', type: GetPhotosResponseDto })
  async findPhotosByMomentId(
    @CurrentUser() user: User,
    @Param('momentId', ParseUUIDPipe) momentId: string,
  ): Promise<RestResponse<GetPhotosResponseDto>> {
    return this.photosService.findPhotosByMomentId(user.id, momentId);
  }
}
