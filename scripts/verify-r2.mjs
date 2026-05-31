#!/usr/bin/env node
// scripts/verify-r2.mjs
//
// Cloudflare R2 연결 + PUT/GET/DELETE 검증 스크립트 (Phase 2 4.3 D3).
//
// 실행:
//   pnpm verify:r2
//   (--env-file=apps/server/.env 옵션이 package.json scripts에 박혀있어 자동 로드)
//
// 사전 조건:
//   apps/server/.env에 R2_* 4개 변수 박혀있을 것
//   (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
//
// 검증 흐름:
//   1. R2 S3 Client 셋업
//   2. 더미 텍스트 파일 PUT (`verify/{timestamp}.txt`)
//   3. 같은 파일 GET → body 비교
//   4. presigned URL 발급 → fetch GET 검증
//   5. DELETE → 정리
//
// 학습 포인트:
//   - region: 'auto' — R2는 region 무관
//   - endpoint: `https://{account_id}.r2.cloudflarestorage.com`
//   - credentials는 환경변수에서만 (절대 hardcode X)
//   - presigned URL은 백엔드 안 거치고 직접 R2 접근 가능 (Phase 2 4.3 D4 모바일 흐름)

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ 환경변수 누락: ${missing.join(', ')}`);
  console.error('   apps/server/.env에 4개 변수 다 박혀있는지 확인하세요.');
  console.error('   (cp apps/server/.env.example apps/server/.env 후 본인 값으로)');
  process.exit(1);
}

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const key = `verify/${Date.now()}.txt`;
const expectedBody = `Hello R2 from Trailog verify script @ ${new Date().toISOString()}`;

async function main() {
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`📦 Bucket:   ${bucket}`);
  console.log(`🔑 Key:      ${key}`);
  console.log('');

  // 1. PUT
  console.log('1️⃣  PUT 더미 파일...');
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: expectedBody,
      ContentType: 'text/plain',
    }),
  );
  console.log('   ✅ PUT 성공');

  // 2. GET (직접)
  console.log('2️⃣  GET (SDK 직접)...');
  const getResult = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await getResult.Body.transformToString();
  if (body !== expectedBody) {
    throw new Error(`GET body 불일치: expected "${expectedBody}", got "${body}"`);
  }
  console.log('   ✅ GET 성공 (body 일치)');

  // 3. Presigned URL 발급 + fetch
  console.log('3️⃣  Presigned GET URL 발급 + fetch...');
  const presignedUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 60,
  });
  console.log(`   ${presignedUrl.slice(0, 80)}...`);
  const fetchRes = await fetch(presignedUrl);
  if (!fetchRes.ok) {
    throw new Error(`Presigned URL fetch 실패: ${fetchRes.status}`);
  }
  const fetchedBody = await fetchRes.text();
  if (fetchedBody !== expectedBody) {
    throw new Error(`Presigned fetch body 불일치`);
  }
  console.log('   ✅ Presigned URL fetch 성공');

  // 4. DELETE
  console.log('4️⃣  DELETE 정리...');
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log('   ✅ DELETE 성공');

  console.log('');
  console.log('🎉 R2 검증 완료 — Phase 2 4.3 D4 (Photo entity + presigned endpoint) 진입 가능');
}

main().catch((error) => {
  console.error('');
  console.error('❌ R2 검증 실패:');
  console.error(`   ${error.name ?? 'Error'}: ${error.message}`);
  if (error.$metadata) {
    console.error(`   HTTP status: ${error.$metadata.httpStatusCode}`);
    console.error(`   Request ID:  ${error.$metadata.requestId}`);
  }
  console.error('');
  console.error('자주 막히는 곳:');
  console.error('  - R2_ACCOUNT_ID가 잘못 박힘 (S3 API URL의 hex 32자만 박을 것, https:// 제외)');
  console.error('  - Access Key / Secret 오타 (1회 표시 후 복사 실수 가능)');
  console.error('  - Bucket name 오타 또는 권한 없는 bucket');
  console.error('  - Token이 Object Read & Write 권한 없음 (Admin 또는 Read & Write 필요)');
  process.exit(1);
});
