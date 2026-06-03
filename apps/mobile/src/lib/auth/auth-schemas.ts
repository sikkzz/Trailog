// auth Zod schemas — ADR-0008 Zod 응답 검증 적용 시작.
//
// 패턴: Schema 단일 출처 → `z.infer<typeof Schema>`로 타입 자동 추론.
// Backend NestJS DTO 변경 시 모바일에서 즉시 발견 (런타임 schema mismatch).
//
// 참조 (Next.js Web) 비교:
// - 회사: shadcn-ui `<Form><FormField>` Radix wrapper (RHF 내부 사용)
// - Trailog (RN): shadcn X — RHF `Controller` 직접 사용 (login.tsx/signup.tsx 참고)
// - Schema 단일 출처는 동일 패턴 (z.infer로 인터페이스 제거)

import { z } from 'zod';

// =============================================================================
// Token (공통)
// =============================================================================

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type TokenPair = z.infer<typeof TokenPairSchema>;

// =============================================================================
// Sign In — POST /auth/sign-in
// =============================================================================

export const SignInRequestSchema = z.object({
  email: z.string().email('이메일 형식이 올바르지 않습니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

export const SignInResponseSchema = TokenPairSchema;

export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type SignInResponse = z.infer<typeof SignInResponseSchema>;

// =============================================================================
// Sign Up — POST /auth/sign-up
// =============================================================================

export const SignUpRequestSchema = z.object({
  email: z.string().email('이메일 형식이 올바르지 않습니다'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(72, '비밀번호는 72자 이하여야 합니다'), // bcrypt 최대 72바이트
});

export const SignUpResponseSchema = TokenPairSchema;

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;
export type SignUpResponse = z.infer<typeof SignUpResponseSchema>;

// =============================================================================
// Refresh Token — POST /auth/refresh
// =============================================================================

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const RefreshTokenResponseSchema = TokenPairSchema;

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;
