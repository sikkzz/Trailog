import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CORS — Expo web dev (http://localhost:8081) + 미래 web 출시 가능성 대응.
  // 모바일 native(iOS/Android)는 CORS 적용 X — 무영향.
  // 운영 web 출시 시 origin 명시 권장 (현재는 dev 편의 위해 전체 허용).
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-platform'],
  });

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

  // Swagger UI — 인터랙티브 API 문서 + 테스트 도구.
  // 학습 단계는 항상 노출. Phase 4 출시 직전 NODE_ENV !== 'production' 분기 추가 검토
  // (메모리 error-handling-revisit 또는 별도 박제 항목).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Trailog API')
    .setDescription(
      '여행 사진 지도 아카이브 — 백엔드 API.\n\n' +
        'Bearer Token 인증 사용. 우측 상단 **Authorize** 버튼으로 accessToken 박제.',
    )
    .setVersion('0.0.1')
    .addBearerAuth(
      // Bearer header 표준 — Q2 결정과 일치 (expo-secure-store + Bearer header)
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'AuthService.login으로 받은 accessToken 박제',
      },
      'access-token', // 식별자 — Controller에서 @ApiBearerAuth('access-token')로 참조
    )
    .addTag('auth', '인증/회원가입/로그인/토큰 갱신')
    .addTag('health', '헬스 체크')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true, // 페이지 새로고침 후에도 token 유지
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 Trailog server is running on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`📖 Swagger UI: http://localhost:${port}/api/docs`);
}

void bootstrap();
