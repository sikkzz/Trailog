import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 모든 endpoint에 입력 검증 자동 적용.
  // - whitelist: DTO에 없는 필드는 제거 (보안 — 의도치 않은 필드 처리 방지)
  // - forbidNonWhitelisted: DTO에 없는 필드 있으면 400 (디버깅 친화)
  // - transform: 평문 body를 class 인스턴스로 변환 (decorator 동작 위해)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 Trailog server is running on http://localhost:${port}`);
}

void bootstrap();
