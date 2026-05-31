// R2Service — Cloudflare R2 (S3 호환) wrapper.
//
// 책임:
// - Presigned PUT URL 발급 (모바일이 R2에 직접 업로드)
// - Presigned GET URL 발급 (모바일이 R2에서 직접 다운로드)
// - 객체 삭제 (Photo soft/hard delete 시점)
//
// 학습 포인트:
// - region: 'auto' — R2는 region 무관
// - endpoint: `https://{account_id}.r2.cloudflarestorage.com`
// - ContentType은 presigned 발급 시 + 업로드 시 일치해야 함 (서명 검증)
// - presigned URL 만료: PUT 5분 / GET 1시간 (Trailog 권장)

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { R2_CLIENT } from './r2.constants';

/** GetObject Body의 stream → Buffer 변환. AWS SDK v3 패턴. */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
  }
  return Buffer.concat(chunks);
}

const PRESIGNED_PUT_EXPIRES_IN = 60 * 5; // 5분 — 업로드 흐름 짧게
const PRESIGNED_GET_EXPIRES_IN = 60 * 60; // 1시간 — 사진 표시 (Phase 후속 캐싱 검토)

@Injectable()
export class R2Service {
  private readonly bucket: string;

  constructor(
    @Inject(R2_CLIENT) private readonly client: S3Client,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
  }

  /**
   * Presigned PUT URL 발급 — 모바일이 R2에 직접 업로드.
   * ContentType은 발급 시 + 업로드 시 정확히 일치해야 함 (서명 검증).
   */
  async createPresignedPutUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_PUT_EXPIRES_IN });
  }

  /** Presigned GET URL 발급 — 모바일이 R2에서 직접 다운로드 (사진 표시). */
  async createPresignedGetUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_GET_EXPIRES_IN });
  }

  /**
   * 객체 binary 다운로드 — worker가 R2 원본 사진을 sharp에 전달할 때 사용.
   * Body는 stream → Buffer 변환.
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`R2 object body is empty: ${key}`);
    }
    return streamToBuffer(response.Body as NodeJS.ReadableStream);
  }

  /** 객체 binary 업로드 — worker가 sharp 변환 결과를 R2에 저장할 때 사용. */
  async putObjectBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** 객체 삭제 — Photo 삭제 흐름 (Phase 후속 hard delete 도입 시점). */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
