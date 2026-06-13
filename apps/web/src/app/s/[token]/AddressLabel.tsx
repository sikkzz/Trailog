'use client';

// AddressLabel — 좌표 → 한국어 주소 (NCP geocoding) Client Component.
//
// 흐름:
//   1. mount 시 백엔드 /geocode/public/reverse 호출 (force-cache — 좌표 → 주소 영구)
//   2. 로딩 중: null (안 보임)
//   3. 성공: 한국어 주소
//   4. 실패 / null 응답: null (안 보임) — 좌표 fallback X (글로벌 좌표는 표시 X)
//
// **좌표 fallback 제거** (2026-06-13 본인 의도): NCP는 한국 외 좌표 변환 X.
// 좌표만 표시되면 사용자가 어디인지 모름 — 정직한 UX는 표시 자체 X.
// 부모 컴포넌트(OpenView)에서 isInKoreaBounds로 미리 conditional 처리.

import { useEffect, useState } from 'react';

import { fetchReverseGeocode } from '@/lib/api';

interface AddressLabelProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function AddressLabel({ latitude, longitude, className }: AddressLabelProps) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReverseGeocode(latitude, longitude)
      .then((result) => {
        if (!cancelled) setAddress(result);
      })
      .catch(() => {
        // 실패 silent
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (!address) return null;
  return <span className={className}>{address}</span>;
}
