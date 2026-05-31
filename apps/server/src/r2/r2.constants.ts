// R2 DI 토큰 — S3Client 인스턴스 주입용.
//
// 사유: NestJS DI는 클래스 토큰이 표준이지만 외부 라이브러리 인스턴스(S3Client)는
// 별도 토큰이 필요. useFactory + provide 패턴.

export const R2_CLIENT = Symbol('R2_CLIENT');
