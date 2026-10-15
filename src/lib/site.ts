/** 절대 URL 기준 (OG 이미지, canonical). Vercel 프로덕션이면 자동으로 잡힌다 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3000');
}

export function formatRange(start: string, end?: string) {
  const f = (d: string) => d.replaceAll('-', '. ');
  if (!end || end === start) return f(start);
  const [sy, sm] = start.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${f(start)} – ${ed}`;
  if (sy === ey) return `${f(start)} – ${em}. ${ed}`;
  return `${f(start)} – ${f(end)}`;
}
