'use client';

// ExpiryLabel — 만료 D-day 친화 표시 (Client Component).
//
// Date.now() 의존이라 SSR/Client 결과 mismatch — Client에서만 render.
// 초기 render는 placeholder (null) → hydration 후 실제 값.
// 1분마다 refresh — 사용자가 가만히 보면 실시간 카운트다운.

import { useEffect, useState } from 'react';

import { formatRemainingTime } from '@/lib/format';

interface ExpiryLabelProps {
  expiresAt: string;
  className?: string;
}

export function ExpiryLabel({ expiresAt, className }: ExpiryLabelProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatRemainingTime(expiresAt));
    update();
    const id = setInterval(update, 60 * 1000); // 1분마다 refresh
    return () => clearInterval(id);
  }, [expiresAt]);

  if (label === null) return null; // SSR/hydration mismatch 회피

  return <span className={className}>{label}</span>;
}
