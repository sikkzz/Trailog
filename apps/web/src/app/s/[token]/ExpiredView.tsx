// 만료된 공유 안내 — 410 응답 시.
//
// Server Component (정적, 인터랙션 X).

export function ExpiredView() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-pretendard-bold text-3xl text-text-primary dark:text-text-primary-dark mb-3">
          만료된 링크예요
        </h1>
        <p className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark">
          공유 링크의 유효 기간이 지났어요.
          <br />
          공유한 사람에게 새로운 링크를 요청해주세요.
        </p>
      </div>
    </main>
  );
}
