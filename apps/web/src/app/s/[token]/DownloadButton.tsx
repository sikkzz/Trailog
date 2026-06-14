// DownloadButton — 사진 단말 저장 (Phase 3 5.2 D5).
//
// **2026-06-14 정정** — 기존 fetch + blob URL 흐름 폐기.
// 백엔드 proxy URL을 단순 `<a href download>` 클릭 → 브라우저가 자동 다운로드.
//
// 백엔드 proxy 이유: R2 cross-origin GET이 403 Forbidden (Origin 박힌 요청
// signature 검증 + CORS rule 적용 차이). 참조 패턴(admin-data-center 서버 단
// stream + Content-Disposition: attachment) 일관 채택 — CORS 우회.
//
// Client Component인 이유: download attribute click event tracking 박을지 등
// 폴리시 시점 inline handler 자유 — 현재는 단순 link.

interface DownloadButtonProps {
  downloadUrl: string;
  className?: string;
}

export function DownloadButton({ downloadUrl, className }: DownloadButtonProps) {
  return (
    <a
      href={downloadUrl}
      // download attribute — 브라우저 hint (백엔드 Content-Disposition이 정직 강제)
      download
      className={
        className ??
        'inline-block font-pretendard-semibold text-sm text-white bg-primary rounded-md px-4 py-2 hover:opacity-80 transition-opacity'
      }
    >
      단말 저장
    </a>
  );
}
