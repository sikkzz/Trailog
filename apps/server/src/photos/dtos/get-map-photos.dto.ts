// GetMapPhotosQueryDto / GetMapPhotosResponseDto
// GET /photos/map?bbox=minLng,minLat,maxLng,maxLat
//
// 지도 viewport 안 본인 사진을 PostGIS bbox 쿼리로 가져오는 endpoint.
// - 본인(userId) 사진만 — JwtAuthGuard + CurrentUser
// - processingStatus='done' 필터 (썸네일 + EXIF 처리 완료된 사진만 pin 표시 가치 ↑)
// - location IS NOT NULL은 ST_Within이 자동으로 거름
//
// **bbox query 형식**: CSV 4 float — `minLng,minLat,maxLng,maxLat`
//   - GeoJSON [lng, lat] 일관성 (DB 저장 형식과 동일 순서)
//   - 예: `bbox=126.97,37.55,127.05,37.60` → 서울 도심 일대
//
// **Validation**:
//   - Transform: 쉼표 구분 string → number[]
//   - ArrayMinSize/ArrayMaxSize: 정확히 4개
//   - IsNumber + IsLatitude/IsLongitude: 각 좌표 유효성
//
// **응답**:
//   - 기존 PhotoListItemDto 재사용 (id/location/takenAt/thumbnailUrls/processingStatus 등)
//   - location은 null 불가능 (ST_Within 조건상) — 단 타입은 일관성 위해 PhotoListItemDto 그대로

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber } from 'class-validator';

import { PhotoListItemDto } from './get-photos.dto';

export class GetMapPhotosQueryDto {
  @ApiProperty({
    example: '126.97,37.55,127.05,37.60',
    description:
      'Viewport bbox — CSV 4 float `minLng,minLat,maxLng,maxLat` (GeoJSON 순서, WGS84/SRID 4326)',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.split(',').map((s) => Number(s.trim()));
  })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsNumber({}, { each: true })
  bbox!: [number, number, number, number];
}

export class GetMapPhotosResponseDto {
  @ApiProperty({
    type: [PhotoListItemDto],
    description: 'bbox 안 본인 사진 — processingStatus=done 만, takenAt DESC 정렬',
  })
  photos!: PhotoListItemDto[];
}
