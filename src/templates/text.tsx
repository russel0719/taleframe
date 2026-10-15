'use client';

import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useMedia } from '@/components/StoryContext';
import type { TemplateProps } from './types';

export function ChapterDivider({ section: s }: TemplateProps<'chapter-divider'>) {
  const media = useMedia(s.media);
  const body = (
    <Reveal className="relative mx-auto max-w-[980px] px-6 text-center">
      {s.index && <p className="t-tagline text-muted mb-4 tabular-nums">{s.index}</p>}
      <h2 className="t-display-lg">{s.title}</h2>
      {s.subtitle && <p className="t-lead-airy text-muted mt-4">{s.subtitle}</p>}
    </Reveal>
  );
  if (!media) return <div className="section-pad py-[120px]">{body}</div>;
  return (
    <div className="relative grid min-h-[70svh] place-items-center overflow-hidden text-on-dark" style={{ ['--tone-muted' as string]: 'rgba(255,255,255,.8)' }}>
      <Img media={media} sizes="100vw" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-black/55" />
      {body}
    </div>
  );
}

export function EditorialText({ section: s }: TemplateProps<'editorial-text'>) {
  const media = useMedia(s.media);
  const text = (
    <div className="max-w-[640px]">
      {s.heading && (
        <Reveal>
          <h2 className="t-display-md mb-6">{s.heading}</h2>
        </Reveal>
      )}
      {s.paragraphs.map((p, i) => (
        <Reveal key={i} delay={i * 0.06}>
          <p className={i === 0 ? 't-lead-airy mb-6' : 't-body mb-5'}>{p}</p>
        </Reveal>
      ))}
    </div>
  );
  if (!media) return <div className="section-pad flex justify-center">{text}</div>;
  const left = s.mediaSide === 'left';
  return (
    <div className="section-pad">
      <div className={`mx-auto grid max-w-[1068px] items-center gap-12 md:grid-cols-[1fr_1.1fr] ${left ? '' : 'md:[&>*:first-child]:order-2'}`}>
        <Reveal>
          <Img media={media} sizes="(max-width: 768px) 92vw, 480px" className="aspect-[4/5] w-full rounded-sm" zoom={{ slides: [{ media }], index: 0 }} />
        </Reveal>
        {text}
      </div>
    </div>
  );
}

export function QuoteMoment({ section: s }: TemplateProps<'quote-moment'>) {
  const media = useMedia(s.media);
  const quote = (
    <Reveal className="relative mx-auto max-w-[860px] px-6 text-center">
      <span aria-hidden className="t-display-lg block text-muted leading-none">“</span>
      <blockquote className="t-display-md mt-2">{s.quote}</blockquote>
      {s.attribution && <p className="t-caption text-muted mt-6">— {s.attribution}</p>}
    </Reveal>
  );
  if (!media) return <div className="section-pad py-[120px]">{quote}</div>;
  return (
    <div className="relative grid min-h-[80svh] place-items-center overflow-hidden text-on-dark" style={{ ['--tone-muted' as string]: 'rgba(255,255,255,.8)' }}>
      <Img media={media} sizes="100vw" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-black/50" />
      {quote}
    </div>
  );
}

export function FactCard({ section: s }: TemplateProps<'fact-card'>) {
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-[980px]">
        {s.heading && <h2 className="t-display-md mb-10 text-center">{s.heading}</h2>}
        <dl className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
          {s.facts.map((f, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <dt className="t-caption text-muted">{f.label}</dt>
              <dd className="t-tagline mt-1">{f.value}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** WMO 날씨 코드 → 한국어 + 아이콘 종류 */
function describeWeather(code: number): { label: string; icon: 'sun' | 'cloud-sun' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' } {
  if (code === 0) return { label: '맑음', icon: 'sun' };
  if (code === 1) return { label: '대체로 맑음', icon: 'cloud-sun' };
  if (code === 2) return { label: '구름 조금', icon: 'cloud-sun' };
  if (code === 3) return { label: '흐림', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: '안개', icon: 'fog' };
  if (code >= 51 && code <= 57) return { label: '이슬비', icon: 'rain' };
  if (code >= 61 && code <= 67) return { label: '비', icon: 'rain' };
  if (code >= 71 && code <= 77) return { label: '눈', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: '소나기', icon: 'rain' };
  if (code === 85 || code === 86) return { label: '눈 소나기', icon: 'snow' };
  if (code >= 95) return { label: '뇌우', icon: 'storm' };
  return { label: '기록 있음', icon: 'cloud' };
}

function WeatherIcon({ kind }: { kind: ReturnType<typeof describeWeather>['icon'] }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const cloud = <path {...p} d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18Z" />;
  return (
    <svg width="96" height="96" viewBox="0 0 24 24" aria-hidden>
      {kind === 'sun' && (
        <>
          <circle {...p} cx="12" cy="12" r="4" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} {...p} d="M12 3v2" transform={`rotate(${a} 12 12)`} />
          ))}
        </>
      )}
      {kind === 'cloud-sun' && (
        <>
          <circle {...p} cx="8" cy="8" r="3" />
          {cloud}
        </>
      )}
      {kind === 'cloud' && cloud}
      {kind === 'fog' && <path {...p} d="M4 9h16M3 13h18M5 17h14" />}
      {kind === 'rain' && (
        <>
          <path {...p} d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7 3.5 3.5 0 0 0 7 14Z" />
          <path {...p} d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
        </>
      )}
      {kind === 'snow' && (
        <>
          <path {...p} d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7 3.5 3.5 0 0 0 7 14Z" />
          <path {...p} d="M8 18h.01M12 20h.01M16 18h.01M10 21h.01M14 21h.01" strokeWidth={2.2} />
        </>
      )}
      {kind === 'storm' && (
        <>
          <path {...p} d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7 3.5 3.5 0 0 0 7 14Z" />
          <path {...p} d="m12 15-2 4h4l-2 4" />
        </>
      )}
    </svg>
  );
}

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

export function WeatherCard({ section: s, weather }: TemplateProps<'weather-card'>) {
  const w = weather ? describeWeather(weather.code) : null;
  return (
    <div className="section-pad">
      <Reveal className="mx-auto flex max-w-[860px] flex-col items-center gap-10 text-center md:flex-row md:text-left">
        {w && (
          <div className="text-muted">
            <WeatherIcon kind={w.icon} />
          </div>
        )}
        <div className="flex-1">
          <p className="t-caption text-muted">
            {s.heading ?? '그날의 날씨'} · {formatDate(s.date)} · {s.place.name}
          </p>
          {weather && w ? (
            <>
              <p className="t-display-lg mt-2">
                {w.label}, {Math.round(weather.tMax)}° <span className="text-muted">/ {Math.round(weather.tMin)}°</span>
              </p>
              <p className="t-body text-muted mt-2">강수량 {weather.precipitation}mm</p>
            </>
          ) : (
            <p className="t-body text-muted mt-2">날씨 기록을 불러오지 못했다.</p>
          )}
          {s.note && <p className="t-lead-airy mt-5">{s.note}</p>}
          {weather && (
            <p className="t-fine text-muted mt-6">
              <a href="https://open-meteo.com/" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                Weather data by Open-Meteo.com
              </a>{' '}
              (CC BY 4.0)
            </p>
          )}
        </div>
      </Reveal>
    </div>
  );
}
