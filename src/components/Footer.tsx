import Link from 'next/link';

/** {component.footer} */
export function Footer() {
  return (
    <footer className="bg-parchment px-6 py-16 text-ink-80">
      <div className="mx-auto max-w-[1068px] space-y-3">
        <Link href="/" className="t-caption-strong text-ink">
          TaleFrame
        </Link>
        <p className="t-fine text-ink-48">
          모든 사진과 영상은 촬영자에게 저작권이 있다. 게시 전 위치 정보(EXIF·GPS)를 제거했다.
        </p>
        <p className="t-fine text-ink-48">
          지도: OpenFreeMap © OpenMapTiles, © OpenStreetMap 기여자 · 날씨: Open-Meteo.com (CC BY 4.0)
        </p>
      </div>
    </footer>
  );
}
