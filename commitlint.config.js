// Trailog commitlint 설정
//
// 형식: <type>(<scope>): <subject>
// - type:    영어 prefix (feat/fix/docs/chore/refactor/style/test/build/ci/perf)
// - scope:   선택 (예: feat(mobile): ...)
// - subject: 한글 OK (한국어 메시지 본문 허용)
//
// 우리 결정 (Phase 1 spec Q4): prefix는 영어 + 본문은 한글
//
// 참고: https://www.conventionalcommits.org/

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 본문 subject 케이스 검사 비활성화 (한글 메시지 허용)
    'subject-case': [0],
    // header 길이 100자까지 (기본 72는 한글에 빡빡함)
    'header-max-length': [2, 'always', 100],
  },
};
