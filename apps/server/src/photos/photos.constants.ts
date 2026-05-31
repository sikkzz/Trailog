// Photos 도메인 상수 — queue 이름, key prefix 등.
//
// 사유: queue 이름을 문자열로 흩뿌리면 오타 위험 + 리네임 어려움.
// 상수로 단일 출처 → InjectQueue(PHOTO_PROCESSING_QUEUE) + Processor(PHOTO_PROCESSING_QUEUE) 일관.

export const PHOTO_PROCESSING_QUEUE = 'photo-processing';
