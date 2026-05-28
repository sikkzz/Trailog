// TokenResponseDto — 모든 인증 endpoint의 success 응답 형태.
//
// 모바일 클라이언트가 expo-secure-store에 저장 + interceptor가 사용.
// 응답에 user 정보를 함께 줄지는 Phase 3에 검토 (현재는 토큰만).

export class TokenResponseDto {
  accessToken!: string;
  refreshToken!: string;
}
