// MomentsModule — Moment 도메인 모듈.
//
// AuthModule을 import해서 JwtAuthGuard + JwtStrategy 의존성 해결 (passport-jwt 활성화).
// AuthModule이 JwtStrategy를 export하지 않더라도, providers에 등록되어 있고
// PassportModule이 strategy 인스턴스를 자동 등록하므로 다른 모듈에서 @UseGuards만으로 사용 가능.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';

import { Moment } from './moment.entity';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Moment]), AuthModule],
  providers: [MomentsService],
  controllers: [MomentsController],
  exports: [MomentsService],
})
export class MomentsModule {}
