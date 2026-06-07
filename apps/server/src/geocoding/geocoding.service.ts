// GeocodingService — NCP Reverse Geocoding API 백엔드 proxy.
//
// =============================================================================
// 1. 왜 백엔드 proxy인가
// =============================================================================
//
// - **OS 통일**: iOS는 Apple CLGeocoder, Android는 Google Geocoder — 같은 좌표여도
//   채워지는 field/포맷 다름. 단일 API로 통일된 UX.
// - **한국어 보장**: NCP는 한국 데이터 + 한국어 기본. expo-location은 시스템 locale 따름.
// - **Client Secret 노출 방지**: NCP API는 Secret 필수. 모바일 bundle에 박으면 노출 위험
//   → 백엔드 only.
//
// =============================================================================
// 2. NCP Reverse Geocoding API
// =============================================================================
//
// Endpoint: https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc
//   (구 naveropenapi.apigw.ntruss.com은 2024+ 마이그레이션 — 신규 게이트웨이 사용)
//
// Headers:
//   - x-ncp-apigw-api-key-id: NCP_CLIENT_ID
//   - x-ncp-apigw-api-key: NCP_CLIENT_SECRET
//
// Query:
//   - coords=lng,lat (longitude 먼저, latitude 다음 — GeoJSON 일관)
//   - orders=roadaddr,addr (도로명 + 지번 둘 다 요청)
//   - output=json
//
// =============================================================================
// 3. 응답 파싱 정책
// =============================================================================
//
// - **roadaddr (도로명) 우선**: 한국 주소 표준
//   "{area1} {area2} {land.name} {land.number1}[ -{number2}][ ({addition0.value})]"
//   예: "서울특별시 중구 세종대로 110 (서울특별시청)"
//
// - **addr (지번) fallback**: 도로명 없을 때 (도로명 미발급 신축/공원/산악 등)
//   "{area1} {area2} {area3} {land.number1}[-{number2}]"
//   예: "서울특별시 중구 태평로1가 31"
//
// - 둘 다 없으면 null (한국 외 좌표 등)

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RestResponse, RestResponseCode } from '../common';

import { ReverseGeocodeResponseDto } from './dtos/reverse-geocode.dto';

const NCP_REVERSE_GEOCODE_ENDPOINT = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';

/**
 * NCP 응답 구조 — 실제 호출 확인 후 정확히 박음.
 * 모든 필드 optional 처리 — null safety.
 */
interface NcpRegionArea {
  name?: string;
  alias?: string;
}

interface NcpLandAddition {
  type?: string;
  value?: string;
}

interface NcpLand {
  type?: string;
  name?: string;
  number1?: string;
  number2?: string;
  addition0?: NcpLandAddition;
  addition1?: NcpLandAddition;
}

interface NcpRegion {
  area0?: NcpRegionArea;
  area1?: NcpRegionArea;
  area2?: NcpRegionArea;
  area3?: NcpRegionArea;
  area4?: NcpRegionArea;
}

interface NcpResult {
  name?: 'roadaddr' | 'addr' | 'admcode' | 'legalcode';
  region?: NcpRegion;
  land?: NcpLand;
}

interface NcpResponse {
  status?: { code?: number; name?: string; message?: string };
  results?: NcpResult[];
  error?: { errorCode?: string; message?: string; details?: string };
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('NCP_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>('NCP_CLIENT_SECRET');
  }

  /**
   * 좌표 → 한국어 주소 (도로명 우선, 지번 fallback).
   *
   * NCP API 호출 실패 시 RestResponse.error (502 BAD_GATEWAY) — 외부 의존 명시.
   */
  async reverseGeocode(lat: number, lng: number): Promise<RestResponse<ReverseGeocodeResponseDto>> {
    const url = new URL(NCP_REVERSE_GEOCODE_ENDPOINT);
    // NCP coords는 GeoJSON 순서와 동일 (lng,lat) — 헷갈리기 쉬움
    url.searchParams.set('coords', `${lng},${lat}`);
    url.searchParams.set('orders', 'roadaddr,addr');
    url.searchParams.set('output', 'json');

    let body: NcpResponse;
    try {
      const response = await fetch(url, {
        headers: {
          'x-ncp-apigw-api-key-id': this.clientId,
          'x-ncp-apigw-api-key': this.clientSecret,
        },
      });
      body = (await response.json()) as NcpResponse;
      if (!response.ok || body.error) {
        this.logger.warn(
          `NCP reverse geocode 실패 (${response.status}): ${body.error?.message ?? 'unknown'}`,
        );
        throw new HttpException('NCP reverse geocode API 호출 실패', HttpStatus.BAD_GATEWAY);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`NCP reverse geocode 네트워크 에러: ${String(error)}`);
      return new RestResponse<ReverseGeocodeResponseDto>().error('주소 변환 일시 실패', {
        code: RestResponseCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.BAD_GATEWAY,
      });
    }

    const dto = this.parseResults(body.results ?? []);
    return new RestResponse<ReverseGeocodeResponseDto>().success(dto);
  }

  /**
   * NCP results → ReverseGeocodeResponseDto.
   * roadaddr 우선 (도로명 + 건물명), addr fallback (지번).
   */
  private parseResults(results: NcpResult[]): ReverseGeocodeResponseDto {
    const road = results.find((r) => r.name === 'roadaddr');
    const roadAddress = road ? this.buildRoadAddress(road) : null;
    if (roadAddress) return { address: roadAddress, type: 'road' };

    const jibun = results.find((r) => r.name === 'addr');
    const jibunAddress = jibun ? this.buildJibunAddress(jibun) : null;
    if (jibunAddress) return { address: jibunAddress, type: 'jibun' };

    return { address: null, type: null };
  }

  /**
   * 도로명 주소 — "{area1} {area2} {land.name} {number1}[ ({건물명})]".
   * 모든 필드 비었으면 null.
   */
  private buildRoadAddress(result: NcpResult): string | null {
    const region = result.region;
    const land = result.land;
    if (!region || !land || !land.name) return null;

    const number = this.combineLandNumber(land.number1, land.number2);
    const parts = [region.area1?.name, region.area2?.name, land.name, number].filter(
      (p): p is string => Boolean(p),
    );
    if (parts.length === 0) return null;

    const base = parts.join(' ');
    const building =
      land.addition0?.type === 'building' && land.addition0.value
        ? ` (${land.addition0.value})`
        : '';
    return `${base}${building}`;
  }

  /**
   * 지번 주소 — "{area1} {area2} {area3} {number1}".
   * 동/리(`area3`)는 도로명과 달리 지번에서 필수.
   */
  private buildJibunAddress(result: NcpResult): string | null {
    const region = result.region;
    const land = result.land;
    if (!region) return null;

    const number = this.combineLandNumber(land?.number1, land?.number2);
    const parts = [region.area1?.name, region.area2?.name, region.area3?.name, number].filter(
      (p): p is string => Boolean(p),
    );
    if (parts.length === 0) return null;

    return parts.join(' ');
  }

  /** `number1`과 `number2` 결합 — "110" 또는 "110-3". 빈 값/공백은 거름. */
  private combineLandNumber(number1?: string, number2?: string): string | null {
    const n1 = number1?.trim();
    const n2 = number2?.trim();
    if (!n1) return null;
    return n2 ? `${n1}-${n2}` : n1;
  }
}
