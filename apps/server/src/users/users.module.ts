// UsersModule — User 엔티티 + UsersService를 DI 컨테이너에 등록 + export.
//
// 학습 포인트:
// - TypeOrmModule.forFeature([User]): User Repository를 DI에 등록 (DatabaseModule.forRoot의 connection 위에).
//   forRoot는 connection 자체, forFeature는 해당 모듈에서 사용할 entity 명시.
// - exports: AuthModule이 UsersService 주입받아 사용 가능하도록.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
