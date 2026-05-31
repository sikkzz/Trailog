// TypeORM DataSource 설정.
//
// 두 가지 용도로 사용:
// 1. NestJS 앱 부팅 시 — DatabaseModule이 이 설정을 참고해서 TypeOrmModule.forRoot에 주입
// 2. TypeORM CLI (`pnpm migration:generate`, `pnpm migration:run`) — CLI는 NestJS 컨텍스트
//    바깥에서 도므로 dotenv 직접 로드 + DataSource 인스턴스 export 필요.
//
// ADR-0006 참고: TypeORM 0.3에서 DataSource가 ormconfig.json을 대체. CLI도 DataSource 기반.

import 'dotenv/config'; // CLI용. NestJS 부팅 경로에선 ConfigModule이 이미 로드함.
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Moment } from '../moments/moment.entity';
import { Photo } from '../photos/photo.entity';
import { User } from '../users/user.entity';

// 환경변수 검증 — 누락 시 명확한 에러로 빠른 실패.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL 환경변수가 필요합니다. apps/server/.env 또는 운영 환경 secrets를 확인하세요.',
  );
}

// 마이그레이션 자동 실행 여부 — 운영에선 false, 로컬 dev에선 true 권장.
// 단 학습 목적으로 명시적 `pnpm migration:run`을 권장 → 항상 false.
const RUN_MIGRATIONS_ON_BOOT = process.env.RUN_MIGRATIONS_ON_BOOT === 'true';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: DATABASE_URL,

  // entity 등록: 명시적 배열 사용 (glob은 TS 컴파일 후 경로 이슈 잦음).
  // 새 entity 추가 시 여기에 한 줄 더 박을 것.
  entities: [User, Moment, Photo],

  // 마이그레이션 디렉토리: 컴파일 후엔 dist/database/migrations 가 됨.
  // TypeORM CLI는 ts-node로 실행되므로 src 기준 glob 사용 가능.
  migrations: [__dirname + '/migrations/*.{ts,js}'],

  // synchronize: 절대 true 금지 (entity 변경이 즉시 DB 반영 → 마이그레이션 우회).
  //   학습 목적으로 마이그레이션 흐름을 명시적으로 다루기 위함.
  synchronize: false,

  // 부팅 시 미실행 마이그레이션 자동 적용 여부. 위 옵션 참고.
  migrationsRun: RUN_MIGRATIONS_ON_BOOT,

  // SQL 로그 — 학습 단계엔 true 추천 (실제 쿼리 확인).
  logging: process.env.TYPEORM_LOGGING === 'true',
};

// CLI 전용 export — TypeORM CLI가 이 default export로 DataSource 인식.
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
