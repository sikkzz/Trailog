// AuthModule — 인증 도메인 묶음.
//
// 학습 포인트:
// - JwtModule.register({}) — 비어있어도 OK (실제 sign 시 옵션을 직접 전달하니까).
//   참조 패턴은 보통 registerAsync로 ConfigService 주입해서 globalSecret 박지만,
//   우리는 access/refresh 두 secret이 다르고 각 sign마다 명시적으로 전달하는 방식이라 비움.
// - UsersModule import: UsersService를 AuthService에 주입받기 위함 (UsersModule이 export 함).
// - PassportModule은 Commit 5(JwtStrategy + Guard)에서 추가 예정.

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({}), // 실제 secret/expiresIn은 AuthService에서 sign할 때 전달
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
