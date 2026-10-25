/** @jsxImportSource hono/jsx */
/**
 * TaleFrame Studio 의 라우트와 문지기. 실행은 server.ts 가 한다 (테스트가 이 앱을 직접 부른다).
 *
 * 보안: 이 서버는 PC 에서 Claude 와 git push 를 실행한다. 그래서
 *  - 사설망 주소(192.168.x · 10.x · 172.16~31.x)와 이 PC 에서 오는 요청만 받는다
 *  - 이 PC 가 아니면 토큰 쿠키가 있어야 한다 (QR 의 ?k= 로 한 번 받는다)
 *  - Windows 방화벽은 "개인 네트워크" 프로필에서만 연다 (scripts/studio-lan.sh)
 */
import fs from 'node:fs';
import path from 'node:path';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import QRCode from 'qrcode';
import { OUT, PORT, lanAddress, slugDir } from './config';
import { busy, jobOf } from './jobs';
import { answer, createTrip, decidePlan, listTrips, publish, review, startAsk, startDraft, startPrepare, tripState } from './trip';
import { ConnectPage, DeniedPage, TripPage, TripsPage } from './ui';
import { existing, writeChunk } from './upload';

export const COOKIE = 'tf_studio';

export function createApp({ lan, token: TOKEN }: { lan: boolean; token: string }) {
  const LAN = lan;
  const app = new Hono();

  const isLoopback = (ip: string) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  const isPrivate = (ip: string) => /^(::ffff:)?(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const remote = (c: Context) => {
    try {
      return getConnInfo(c).remote.address ?? '';
    } catch {
      return ''; // 연결 정보를 모르면 바깥 요청으로 취급한다
    }
  };

  // ── 문지기 ────────────────────────────────────────────────────
  app.use('*', async (c, nextHandler) => {
    const ip = remote(c);
    if (isLoopback(ip)) return nextHandler();
    if (!isPrivate(ip)) return c.text('forbidden', 403);
    if (getCookie(c, COOKIE) === TOKEN) return nextHandler();
    const k = c.req.query('k');
    if (k && k === TOKEN) {
      setCookie(c, COOKIE, TOKEN, { httpOnly: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 365, path: '/' });
      const url = new URL(c.req.url);
      url.searchParams.delete('k');
      return c.redirect(url.pathname + url.search);
    }
    if (c.req.path.startsWith('/static/')) return nextHandler();
    return c.html(<DeniedPage />, 403);
  });

  const validSlug = (slug: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && fs.existsSync(slugDir(slug));
  function guard(c: Context): string | null {
    const slug = c.req.param('slug') ?? '';
    return validSlug(slug) ? slug : null;
  }
  const started = (c: Context, r: unknown) =>
    r && typeof r === 'object' && 'busy' in r
      ? c.json({ ok: false, error: `다른 작업이 돌고 있다: ${(r as { busy: { title: string; slug: string } }).busy.title} (${(r as { busy: { slug: string } }).busy.slug})` }, 409)
      : c.json({ ok: true });

  // ── 화면 ──────────────────────────────────────────────────────
  app.use('/static/*', serveStatic({ root: path.relative(process.cwd(), path.join(import.meta.dirname, 'public')), rewriteRequestPath: (p) => p.replace(/^\/static/, '') }));
  // 미리보기: NEXT_PUBLIC_BASE_PATH=/preview 로 빌드한 out/ (게시본과 같은 렌더러)
  app.use('/preview/*', serveStatic({ root: path.relative(process.cwd(), OUT), rewriteRequestPath: (p) => p.replace(/^\/preview/, '') }));

  app.get('/', (c) => c.html(<TripsPage trips={listTrips()} />));

  app.get('/connect', async (c) => {
    const host = LAN ? lanAddress() : undefined;
    const url = host ? `http://${host}:${PORT}/?k=${TOKEN}` : `http://127.0.0.1:${PORT}/`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 280 });
    return c.html(<ConnectPage url={url} svg={host ? svg : ''} firewallHint={!!host} />);
  });

  app.get('/t/:slug', (c) => {
    const slug = guard(c);
    return slug ? c.html(<TripPage s={tripState(slug)} />) : c.notFound();
  });

  app.get('/t/:slug/thumb/:id', (c) => {
    const slug = guard(c);
    const id = c.req.param('id');
    if (!slug || !/^m\d{3,4}$/.test(id)) return c.notFound();
    for (const f of [`${id}.jpg`, `${id}_b.jpg`]) {
      const p = path.join(slugDir(slug), 'thumbs', f);
      if (fs.existsSync(p)) return c.body(fs.readFileSync(p), 200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' });
    }
    return c.notFound();
  });

  // ── API ───────────────────────────────────────────────────────
  app.post('/api/trips', async (c) => {
    const { name, address } = await c.req.json<{ name?: string; address?: string }>();
    return c.json({ ok: true, slug: createTrip(String(name ?? '').slice(0, 60), String(address ?? '').slice(0, 60)) });
  });

  app.get('/api/t/:slug/job', (c) => {
    const slug = guard(c);
    if (!slug) return c.notFound();
    const job = jobOf(slug);
    // 폰 시계와 PC 시계가 다를 수 있다 — 경과 시간은 서버 시각 기준으로 센다
    return c.json(job && { ...job, now: Date.now() });
  });

  app.post('/api/t/:slug/upload/check', async (c) => {
    const slug = guard(c);
    if (!slug) return c.notFound();
    const { files } = await c.req.json<{ files: { name: string; size: number }[] }>();
    return c.json({ skip: existing(slug, files ?? []) });
  });

  app.put('/api/t/:slug/upload', async (c) => {
    const slug = guard(c);
    if (!slug) return c.notFound();
    const name = c.req.query('name') ?? '';
    const size = Number(c.req.query('size'));
    const offset = Number(c.req.query('offset'));
    const r = writeChunk(slug, name, size, offset, Buffer.from(await c.req.arrayBuffer()));
    if (r.status === 'invalid') return c.json(r, 400);
    return c.json(r, r.status === 'conflict' ? 409 : 200);
  });

  const action = (fn: (slug: string, c: Context) => unknown) => async (c: Context) => {
    const slug = guard(c);
    if (!slug) return c.notFound();
    if (busy() && busy()!.slug !== slug) return started(c, { busy: busy() });
    try {
      return started(c, await fn(slug, c));
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message }, 400);
    }
  };

  app.post('/api/t/:slug/prepare', action((slug) => startPrepare(slug)));
  app.post('/api/t/:slug/next', action((slug) => startAsk(slug)));
  app.post('/api/t/:slug/build', action((slug) => startDraft(slug)));
  app.post(
    '/api/t/:slug/answers',
    action(async (slug, c) => answer(slug, (await c.req.json<{ answers: Record<string, { choices?: string[]; text?: string }> }>()).answers)),
  );
  app.post(
    '/api/t/:slug/plan',
    action(async (slug, c) => {
      const b = await c.req.json<{ approve?: string; text?: string }>();
      if (!b.approve && !b.text?.trim()) throw new Error('바꿀 점을 적어 준다');
      return decidePlan(slug, !!b.approve, b.text ?? '');
    }),
  );
  app.post(
    '/api/t/:slug/review',
    action(async (slug, c) => {
      const b = await c.req.json<{
        approve?: string[];
        all?: string;
        requests?: { section: string; text: string }[];
        answers?: Record<string, { choices?: string[]; text?: string }>;
      }>();
      return review(slug, { approve: b.approve ?? [], requests: b.requests ?? [], answers: b.answers ?? {}, all: !!b.all });
    }),
  );
  app.post(
    '/api/t/:slug/publish',
    action(async (slug, c) => {
      const b = await c.req.json<{ confirm?: string }>();
      if (!b.confirm) throw new Error('공개를 확인해 준다');
      if (!tripState(slug).allApproved) throw new Error('승인하지 않은 섹션이 있다');
      return publish(slug);
    }),
  );
  app.post(
    '/api/t/:slug/retry',
    action((slug) => {
      const kind = jobOf(slug)?.kind;
      if (kind === 'prepare') return startPrepare(slug);
      if (kind === 'ask') return startAsk(slug);
      if (kind === 'draft' || kind === 'revise') return startDraft(slug);
      if (kind === 'publish') return publish(slug);
      throw new Error('다시 실행할 작업이 없다');
    }),
  );

  return app;
}
