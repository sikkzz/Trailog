import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MomentsModule } from './moments/moments.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [DatabaseModule, HealthModule, UsersModule, AuthModule, MomentsModule],
})
export class AppModule {}
