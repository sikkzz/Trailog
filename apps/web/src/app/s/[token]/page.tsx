// 공유 페이지 — /s/[token]
//
// Server Component (Next 16 App Router).
// 흐름:
//   1. SSR fetch — 백엔드 GET /shares/public/:token
//   2. 404 → notFound() (Next 자동 처리)
//   3. 410 → 만료 안내 UI
//   4. status='locked' → 비밀번호 입력 화면 (client component)
//   5. status='open' → target 분기 (photo 단일 / moment 전체)

import { notFound } from 'next/navigation';

import { fetchPublicShare } from '@/lib/api';

import { ExpiredView } from './ExpiredView';
import { LockedView } from './LockedView';
import { OpenView } from './OpenView';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const result = await fetchPublicShare(token);

  if (result.status === 404 || !result.data) {
    notFound();
  }

  if (result.status === 410) {
    return <ExpiredView />;
  }

  if (result.data.status === 'locked') {
    return <LockedView token={token} />;
  }

  return <OpenView share={result.data} />;
}
