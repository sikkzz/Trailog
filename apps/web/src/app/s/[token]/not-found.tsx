// 404 — 공유 링크 없음.

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-pretendard-bold text-3xl text-text-primary dark:text-text-primary-dark mb-3">
          공유 링크를 찾을 수 없어요
        </h1>
        <p className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark">
          링크가 잘못되었거나, 공유한 사람이 취소했어요.
        </p>
      </div>
    </main>
  );
}
