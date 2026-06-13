// 정상 공유 — target 분기로 photo 또는 moment 표시.
//
// D6c 풍부화 (2026-06-13):
//   - 한국어 주소 (AddressLabel — NCP geocoding via 백엔드 proxy)
//   - 만료 D-day (ExpiryLabel — Client Component, 1분 refresh)
//   - 다운로드 (DownloadButton — fetch + blob URL)
//   - EXIF strip 안내 (formatExifPolicy)
//
// 미니맵(NaverMap Web SDK)은 별도 commit — Client ID Web 도메인 등록 부담.

import { formatDate, formatDateTime, formatExifPolicy, isInKoreaBounds } from '@/lib/format';
import type { PublicShareResponse } from '@/lib/schemas';

import { AddressLabel } from './AddressLabel';
import { DownloadButton } from './DownloadButton';
import { ExpiryLabel } from './ExpiryLabel';

interface OpenViewProps {
  share: PublicShareResponse;
}

export function OpenView({ share }: OpenViewProps) {
  if (share.target === 'photo' && share.photo) {
    return (
      <PhotoView
        photo={share.photo}
        expiresAt={share.expiresAt}
        exifPolicy={share.exifStripPolicy}
      />
    );
  }

  if (share.target === 'moment' && share.moment) {
    return (
      <MomentView
        moment={share.moment}
        expiresAt={share.expiresAt}
        exifPolicy={share.exifStripPolicy}
      />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p className="font-pretendard text-base text-text-secondary dark:text-text-secondary-dark">
        표시할 데이터가 없어요.
      </p>
    </main>
  );
}

/** 단일 사진 공유 — full-width 사진 + 메타 + 다운로드 */
function PhotoView({
  photo,
  expiresAt,
  exifPolicy,
}: {
  photo: NonNullable<PublicShareResponse['photo']>;
  expiresAt: string | null;
  exifPolicy: PublicShareResponse['exifStripPolicy'];
}) {
  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-2xl mx-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt="공유 사진" className="w-full rounded-lg" />

        <div className="mt-6 px-2 space-y-2">
          {photo.takenAt && <MetaRow label="촬영" value={formatDateTime(photo.takenAt)} />}
          {photo.location && isInKoreaBounds(photo.location.latitude, photo.location.longitude) && (
            <MetaRow
              label="위치"
              value={
                <AddressLabel
                  latitude={photo.location.latitude}
                  longitude={photo.location.longitude}
                />
              }
            />
          )}
          <MetaRow label="메타데이터" value={formatExifPolicy(exifPolicy)} />
          {expiresAt && (
            <MetaRow label="만료" value={<ExpiryLabel expiresAt={expiresAt} />} />
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <DownloadButton url={photo.imageUrl} photoId={photo.id} />
        </div>

        <FooterNote />
      </div>
    </main>
  );
}

/** Moment 전체 공유 — 사진 그리드 + 각 사진 다운로드 */
function MomentView({
  moment,
  expiresAt,
  exifPolicy,
}: {
  moment: NonNullable<PublicShareResponse['moment']>;
  expiresAt: string | null;
  exifPolicy: PublicShareResponse['exifStripPolicy'];
}) {
  return (
    <main className="min-h-screen bg-background dark:bg-background-dark">
      <div className="max-w-3xl mx-auto p-4">
        <header className="mb-6 pt-4">
          <h1 className="font-pretendard-bold text-3xl text-text-primary dark:text-text-primary-dark mb-2">
            {moment.title}
          </h1>
          <div className="space-y-1">
            {moment.startedAt && (
              <p className="font-pretendard text-sm text-text-secondary dark:text-text-secondary-dark">
                {formatDate(moment.startedAt)}
                {moment.endedAt && ` ~ ${formatDate(moment.endedAt)}`}
              </p>
            )}
            <p className="font-pretendard text-xs text-text-tertiary dark:text-text-tertiary-dark">
              사진 {moment.photos.length}장 · {formatExifPolicy(exifPolicy)}
              {expiresAt && (
                <>
                  {' '}· <ExpiryLabel expiresAt={expiresAt} />
                </>
              )}
            </p>
          </div>
        </header>

        {moment.photos.length === 0 ? (
          <p className="font-pretendard text-base text-text-tertiary dark:text-text-tertiary-dark text-center py-12">
            사진이 없어요.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {moment.photos.map((p) => (
              <PhotoCell key={p.id} photo={p} />
            ))}
          </div>
        )}

        <FooterNote />
      </div>
    </main>
  );
}

/** Moment 그리드 단일 cell — 사진 + 위치 + 다운로드 */
function PhotoCell({ photo }: { photo: NonNullable<PublicShareResponse['photo']> }) {
  return (
    <div className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl}
        alt="공유 사진"
        className="w-full aspect-square object-cover rounded"
      />
      {photo.location && isInKoreaBounds(photo.location.latitude, photo.location.longitude) && (
        <p className="font-pretendard text-xs text-text-tertiary dark:text-text-tertiary-dark px-1 truncate">
          <AddressLabel
            latitude={photo.location.latitude}
            longitude={photo.location.longitude}
          />
        </p>
      )}
      <div className="px-1">
        <DownloadButton
          url={photo.imageUrl}
          photoId={photo.id}
          className="font-pretendard text-xs text-primary hover:opacity-70 transition-opacity"
        />
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start text-white/90 gap-3">
      <span className="font-pretendard text-sm text-white/60 min-w-[70px] shrink-0">{label}</span>
      <span className="font-pretendard-medium text-sm text-right">{value}</span>
    </div>
  );
}

function FooterNote() {
  return (
    <footer className="mt-12 mb-6 text-center">
      <p className="font-pretendard text-xs text-text-tertiary dark:text-text-tertiary-dark">
        Trailog — 여행 사진 지도 아카이브
      </p>
    </footer>
  );
}
