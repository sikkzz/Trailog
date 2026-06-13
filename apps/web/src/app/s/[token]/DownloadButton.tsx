'use client';

// DownloadButton — 사진 단말 저장 (Client Component).
//
// 본인 의도 "아카이빙" 핵심 — 외부 사용자가 자기 단말에 저장.
// `<a download>` cross-origin 제한 회피 위해 fetch + blob URL 활용 (lib/format.downloadPhoto).
//
// R2 presigned URL의 CORS 응답 헤더에 의존. R2 dashboard CORS 설정(`allowed_origins: *`)
// 또는 Cloudflare R2 default 정책으로 보통 동작. 실패 시 안내.

import { useState } from 'react';

import { downloadPhoto } from '@/lib/format';

interface DownloadButtonProps {
  url: string;
  photoId: string;
  className?: string;
}

export function DownloadButton({ url, photoId, className }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setDownloading(true);
    setError(null);
    try {
      // 파일명 — photoId + 확장자 추정 (URL의 파일명에서 추출 시도, 실패 시 .jpg fallback)
      const filename = inferFilename(url, photoId);
      await downloadPhoto(url, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : '다운로드 실패');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={downloading}
        className={
          className ??
          'font-pretendard-semibold text-sm text-white bg-primary rounded-md px-4 py-2 hover:opacity-80 disabled:opacity-50 transition-opacity'
        }
      >
        {downloading ? '저장 중...' : '단말 저장'}
      </button>
      {error && (
        <p className="font-pretendard text-xs text-danger mt-1" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** URL의 path에서 파일명 추출 (예: `.../abc.jpg?X-Amz-...`). 실패 시 photoId.jpg fallback. */
function inferFilename(url: string, photoId: string): string {
  try {
    const u = new URL(url);
    const lastSegment = u.pathname.split('/').pop();
    if (lastSegment && lastSegment.includes('.')) {
      return `trailog-${photoId.slice(0, 8)}-${lastSegment}`;
    }
  } catch {
    // URL parse 실패 — fallback
  }
  return `trailog-${photoId.slice(0, 8)}.jpg`;
}
