// NestJS DatabaseModule — 앱 부팅 시 TypeORM 연결 + entity Repository를 DI 컨테이너에 등록.
//
// data-source.ts의 dataSourceOptions를 그대로 재사용해서 CLI/앱이 같은 설정 보장.
// (다른 곳에 옵션 두 곳 두면 entity 누락 같은 drift 발생)

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    // ConfigModule이 .env를 process.env에 로드 — data-source.ts의 검증이 통과되도록 먼저 로드.
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
