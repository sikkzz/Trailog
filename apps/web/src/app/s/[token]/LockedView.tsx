'use client';

// 비밀번호 보호 — 입력 화면 (Client Component).
//
// 흐름:
//   1. 비밀번호 입력
//   2. submit → POST /shares/public/:token/unlock
//   3. 401: "비밀번호가 올바르지 않아요"
//   4. 200: 응답 data로 즉시 OpenView 렌더 (별도 reload 없음)
//
// **2026-06-13 D6b 정정** — 원래 setUnlocked(true) + "확인됨" 텍스트만 → unlock 응답의
// share data를 그대로 OpenView에 전달. 백엔드 buildOpenResponse가 photo/moment 데이터까지
// 응답으로 보내므로 그 data 활용. 별도 SSR 재호출 X (보안 측면 OK — 서버 신뢰).
//
// 단점: 클라이언트가 페이지를 새로고침하면 다시 LockedView로 진입 → 비밀번호 재입력 필요.
// sessionStorage 토큰 발급 흐름은 Phase 후속.

import { useState } from 'react';

import { unlockPublicShare } from '@/lib/api';
import type { PublicShareResponse } from '@/lib/schemas';

import { OpenView } from './OpenView';

interface LockedViewProps {
  token: string;
}

export function LockedView({ token }: LockedViewProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [shareData, setShareData] = useState<PublicShareResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다');
      return;
    }
    setError(null);
    setIsUnlocking(true);

    try {
      const result = await unlockPublicShare(token, password);
      if (result.status === 401) {
        setError('비밀번호가 올바르지 않아요');
        setIsUnlocking(false);
        return;
      }
      if (result.status === 200 && result.data) {
        setShareData(result.data);
        setIsUnlocking(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했어요');
      setIsUnlocking(false);
    }
  };

  // unlock 성공 → 응답 data로 즉시 OpenView 렌더 (별도 SSR 재호출 X)
  if (shareData) {
    return <OpenView share={shareData} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="font-pretendard-bold text-3xl text-text-primary dark:text-text-primary-dark mb-2 text-center">
          비밀번호 입력
        </h1>
        <p className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark mb-8 text-center">
          이 공유 링크는 비밀번호로 보호되어 있어요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (4자 이상)"
            className="w-full font-pretendard text-base bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border border-border dark:border-border-dark rounded-md px-4 py-3 focus:outline-none focus:border-primary"
            disabled={isUnlocking}
            autoFocus
          />

          {error && <p className="font-pretendard text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={isUnlocking}
            className="w-full font-pretendard-semibold text-base text-white bg-primary rounded-md py-3 hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {isUnlocking ? '확인 중...' : '입력'}
          </button>
        </form>
      </div>
    </main>
  );
}
