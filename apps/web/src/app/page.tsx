// Trailog Web root — `/` 진입 시 안내.
//
// 외부 사용자가 공유 링크 없이 들어왔을 때.
// 본인 박제 도구 본질이라 root는 단순 안내 + 앱 다운로드 유도(Phase 4+).

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-pretendard-bold text-4xl text-primary mb-3">Trailog</h1>
        <p className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark mb-8">
          여행 사진 지도 아카이브
        </p>
        <p className="font-pretendard text-sm text-text-tertiary dark:text-text-tertiary-dark">
          공유 받은 링크를 통해서만 접근할 수 있어요.
        </p>
      </div>
    </main>
  );
}
