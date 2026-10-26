'use client';

import { useSyncExternalStore } from 'react';

/**
 * 실험실 필터 — `?t=stamp-rally,day-clock` 이면 그 템플릿 섹션만 보인다.
 * 실험실은 정적 페이지라 서버에서 쿼리를 읽지 않고, 브라우저에서 나머지를 숨긴다.
 */
export function LabFilter() {
  // 서버에서는 빈 문자열 — 하이드레이션 뒤 주소의 쿼리를 읽는다
  const search = useSyncExternalStore(
    () => () => {},
    () => location.search,
    () => '',
  );
  const only = (new URLSearchParams(search).get('t') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^[a-z-]+$/.test(x));
  if (!only.length) return null;
  const keep = only.map((t) => `:not([data-template="${t}"])`).join('');
  return (
    <>
      <style>{`main > section${keep} { display: none; }`}</style>
      <p className="t-caption bg-[#e8f1fb] px-6 py-3 text-ink">
        보이는 템플릿: {only.join(', ')} · <a href="?" className="text-primary underline">전부 보기</a>
      </p>
    </>
  );
}
