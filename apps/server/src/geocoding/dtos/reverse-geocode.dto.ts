// ReverseGeocodeQueryDto / ReverseGeocodeResponseDto
// GET /geocode/reverse?lat=37.5665&lng=126.978
//
// NCP Reverse Geocoding API 백엔드 proxy — OS별 차이(iOS Apple Geocoding vs
// Android Google Geocoding) 통일 + 한국어 보장 + Client Secret 백엔드 only.
//
// 응답:
//   - address: 한 줄 주소 (도로명 우선, 지번 fallback). 좌표가 한국 외/응답 결과 X면 null
//   - type: 'road' | 'jibun' | null — 어떤 주소 종류인지

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

export class ReverseGeocodeQueryDto {
  @ApiProperty({ example: 37.5665, description: '위도 (WGS84)' })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 126.978, description: '경도 (WGS84)' })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}

export class ReverseGeocodeResponseDto {
  @ApiProperty({
    example: '서울특별시 중구 세종대로 110 (서울특별시청)',
    nullable: true,
    description: '한국어 주소 (도로명 우선, 지번 fallback). 한국 외/결과 X면 null',
  })
  address!: string | null;

  @ApiProperty({
    enum: ['road', 'jibun'],
    nullable: true,
    description: '도로명/지번 종류. address가 null이면 null',
  })
  type!: 'road' | 'jibun' | null;
}
