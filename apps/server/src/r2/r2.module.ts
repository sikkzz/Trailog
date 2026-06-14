// R2Module — Cloudflare R2 client + service.
//
// 다른 도메인에서 R2 접근 필요 시 R2Module을 import + R2Service 주입.
// 예: PhotosModule(Phase 2 4.3 D4), 미래 ProfileImageModule 등.

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

import { R2_CLIENT } from './r2.constants';
import { R2Service } from './r2.service';

@Module({
  providers: [
    {
      provide: R2_CLIENT,
      useFactory: (configService: ConfigService) =>
        new S3Client({
          region: 'auto', // R2는 region 무관
          endpoint: `https://${configService.getOrThrow<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
            secretAccessKey: configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
          },
          // R2 호환성 — AWS SDK v3.700+의 "Default integrity protections" 비활성.
          // 활성 시 SDK가 자동으로 X-Amz-Checksum-Mode=ENABLED 박는데 R2 SigV4가
          // 거부 (403 Forbidden). presigned URL fail이 본 옵션으로 해결.
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        }),
      inject: [ConfigService],
    },
    R2Service,
  ],
  exports: [R2Service],
})
export class R2Module {}
