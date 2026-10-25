import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { describeTool, watchStream } from '../studio/agent';
import { createApp } from '../studio/app';
import { slugDir } from '../studio/config';
import { addRedirect } from '../scripts/lib/rename';
import { createTrip, currentStep, type TripState } from '../studio/trip';
import { existing, inboxStats, safeName, writeChunk } from '../studio/upload';

const SLUG = 'vitest-studio';
const inbox = path.join(slugDir(SLUG), 'inbox');
fs.mkdirSync(inbox, { recursive: true });
afterAll(() => fs.rmSync(slugDir(SLUG), { recursive: true, force: true }));

describe('업로드', () => {
  it('경로 성분과 사진·영상이 아닌 파일을 떼어낸다', () => {
    expect(safeName('../../etc/passwd.jpg')).toBe('passwd.jpg');
    expect(safeName('..\\..\\x.MOV')).toBe('x.MOV');
    expect(safeName('사진 1.HEIC')).toBe('사진 1.HEIC');
    expect(safeName('.hidden.jpg')).toBeNull();
    expect(safeName('run.sh')).toBeNull();
  });

  it('청크를 이어 받고, 어긋난 offset 은 서버가 가진 크기로 되돌려 보낸다', () => {
    const data = Buffer.from('0123456789');
    expect(writeChunk(SLUG, 'a.jpg', 10, 0, data.subarray(0, 4))).toEqual({ status: 'partial', received: 4 });
    // 끊겼다가 처음부터 다시 보내면 — 서버는 4바이트까지 받았다고 알려준다
    expect(writeChunk(SLUG, 'a.jpg', 10, 0, data.subarray(0, 4))).toEqual({ status: 'conflict', received: 4 });
    expect(fs.existsSync(path.join(inbox, 'a.jpg'))).toBe(false); // 다 받기 전에는 inbox 에 없다
    expect(writeChunk(SLUG, 'a.jpg', 10, 4, data.subarray(4))).toEqual({ status: 'complete', received: 10 });
    expect(fs.readFileSync(path.join(inbox, 'a.jpg'), 'utf8')).toBe('0123456789');
    expect(fs.existsSync(path.join(inbox, '.parts', 'a.jpg.part'))).toBe(false);
  });

  it('선언한 크기보다 큰 청크는 거부한다', () => {
    expect(writeChunk(SLUG, 'b.jpg', 3, 0, Buffer.from('1234')).status).toBe('invalid');
  });

  it('같은 이름·같은 크기는 다시 올리지 않는다', () => {
    expect(existing(SLUG, [{ name: 'a.jpg', size: 10 }, { name: 'a.jpg', size: 11 }, { name: 'c.jpg', size: 10 }])).toEqual(['a.jpg']);
    expect(inboxStats(SLUG)).toMatchObject({ images: 1, videos: 0, bytes: 10 });
  });
});

describe('문지기', () => {
  const TOKEN = 'test-token';
  const app = createApp({ lan: true, token: TOKEN });
  const from = (ip: string) => ({ incoming: { socket: { remoteAddress: ip } } });

  it('이 PC 에서는 토큰 없이 들어온다', async () => {
    expect((await app.request('/', {}, from('127.0.0.1'))).status).toBe(200);
  });

  it('사설망이 아닌 주소는 무조건 막는다', async () => {
    expect((await app.request(`/?k=${TOKEN}`, {}, from('8.8.8.8'))).status).toBe(403);
  });

  it('같은 와이파이라도 토큰이 없으면 막는다', async () => {
    const res = await app.request('/', {}, from('192.168.0.23'));
    expect(res.status).toBe(403);
    const up = await app.request(`/api/t/${SLUG}/upload?name=x.jpg&size=1&offset=0`, { method: 'PUT', body: 'x' }, from('192.168.0.23'));
    expect(up.status).toBe(403);
    expect(fs.existsSync(path.join(inbox, 'x.jpg'))).toBe(false);
  });

  it('QR 의 토큰으로 한 번 들어오면 쿠키로 기억한다', async () => {
    const first = await app.request(`/t/${SLUG}?k=${TOKEN}`, {}, from('192.168.0.23'));
    expect(first.status).toBe(302);
    expect(first.headers.get('location')).toBe(`/t/${SLUG}`);
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    expect((await app.request(`/t/${SLUG}`, { headers: { cookie } }, from('192.168.0.23'))).status).toBe(200);
    expect((await app.request('/', { headers: { cookie: 'tf_studio=wrong' } }, from('192.168.0.23'))).status).toBe(403);
  });

  it('여행 이름으로 경로를 빠져나갈 수 없다', async () => {
    expect((await app.request('/t/..%2F..%2Fetc', {}, from('127.0.0.1'))).status).toBe(404);
    expect((await app.request(`/t/${SLUG}/thumb/..%2Finventory`, {}, from('127.0.0.1'))).status).toBe(404);
  });
});

describe('단계', () => {
  const base = {
    inbox: { files: ['a.jpg'], images: 1, videos: 0, bytes: 1 },
    scanned: true,
    needsScan: false,
    analysis: { done: 1, total: 1 },
    hasGps: false,
    places: false,
    phases: {},
    planApproved: false,
    gaps: null,
    story: null,
    hasMedia: false,
    previewFresh: false,
    allApproved: false,
    published: null,
  } as unknown as TripState;
  const at = (o: Partial<Record<keyof TripState, unknown>>) => currentStep({ ...base, ...o } as TripState);
  const story = { status: 'draft' };

  it('사진 질문 → 웹 방향 → 레이아웃 → 초안 → 확인·보완 → 게시 순서로 간다', () => {
    expect(at({ inbox: { files: [] }, scanned: false })).toBe('upload');
    expect(at({ needsScan: true })).toBe('prepare'); // 사진을 더 올리면 다시 정리
    expect(at({ analysis: { done: 0, total: 1 } })).toBe('prepare');
    expect(at({ hasGps: true, places: false })).toBe('prepare');
    expect(at({})).toBe('photos');
    expect(at({ phases: { photos: true } })).toBe('direction');
    expect(at({ phases: { photos: true, direction: true } })).toBe('layout');
    expect(at({ phases: { photos: true, direction: true }, planApproved: true })).toBe('draft');
    expect(at({ story, hasMedia: true, previewFresh: false })).toBe('draft');
    expect(at({ story, hasMedia: true, previewFresh: true })).toBe('review');
    // 전부 승인해도 답하지 않은 보완 질문이 남아 있으면 확인 단계에 머문다
    expect(at({ story, hasMedia: true, previewFresh: true, allApproved: true, gaps: { questions: [{}] } })).toBe('review');
    expect(at({ story, hasMedia: true, previewFresh: true, allApproved: true })).toBe('publish');
  });

  it('이미 초안이 있는 여행(스킬로 만든 것)은 질문 단계를 건너뛴다', () => {
    expect(at({ story, hasMedia: true, previewFresh: true, phases: {} })).toBe('review');
  });
});

describe('진행 상황', () => {
  it('도구 호출을 폰에 보일 한 줄로 바꾼다', () => {
    expect(describeTool({ type: 'tool_use', name: 'Read', input: { file_path: '/x/.claude/skills/travel-story/interview.md' } })).toBe('읽는 중 · travel-story/interview.md');
    expect(describeTool({ type: 'tool_use', name: 'Bash', input: { command: 'npm run tf -- catalog' } })).toBe('실행 · tf catalog');
  });

  it('stream-json 에서 활동을 흘리고 마지막 result 를 돌려준다', () => {
    const seen: (string | undefined)[] = [];
    const w = watchStream({ activity: (l) => seen.push(l) });
    const ev = (o: object) => w.line(JSON.stringify(o));
    ev({ type: 'system', subtype: 'init' });
    ev({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'thinking' } } });
    ev({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'work/a/analysis.json' } }] } });
    ev({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'tool_use', name: 'StructuredOutput' } } });
    ev({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"plan":' } } });
    w.line('깨진 줄');
    ev({ type: 'result', subtype: 'success', structured_output: { ok: 1 }, total_cost_usd: 0.1 });
    expect(seen).toEqual([undefined, '생각하는 중', '읽는 중 · a/analysis.json', '답 쓰는 중', '답 쓰는 중 · 8자']);
    expect(w.result()?.structured_output).toEqual({ ok: 1 });
  });
});

describe('주소', () => {
  it('한글 이름에서 숫자만 남으면 쓰지 않고, 영문 주소를 따로 받으면 그것을 쓴다', () => {
    const a = createTrip('다카마쓰 2026');
    const b = createTrip('다카마쓰 2026', 'Vitest Addr ZZ');
    try {
      expect(a).toMatch(/^trip-\d{8}/);
      expect(b).toBe('vitest-addr-zz');
    } finally {
      for (const s of [a, b]) fs.rmSync(slugDir(s), { recursive: true, force: true });
    }
  });

  it('옛 주소 넘김은 이어진 이름을 새 주소로 바로 보내고, 되돌린 이름은 지운다', () => {
    expect(addRedirect({ a: 'b' }, 'b', 'c')).toEqual({ a: 'c', b: 'c' });
    expect(addRedirect({ a: 'b' }, 'b', 'a')).toEqual({ b: 'a' });
  });
});
