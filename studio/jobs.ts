import { spawn } from 'node:child_process';
import path from 'node:path';
import { NTFY_TOPIC, ROOT, STATE, readJsonFile, studioDir, writeJsonFile } from './config';

/**
 * 오래 걸리는 작업(스캔·훑어보기·질문 만들기·변환·빌드·게시)을 백그라운드로 돌린다.
 * Claude 와 ffmpeg 가 무거워서 **한 번에 하나만** 돈다. 폰은 /job 을 폴링한다.
 * 상태는 work/<slug>/studio/job.json 에도 남겨, 화면을 닫았다 열어도 이어서 보인다.
 */
export type Job = {
  slug: string;
  kind: string;
  title: string;
  state: 'running' | 'done' | 'error';
  startedAt: number;
  endedAt?: number;
  step?: string;
  /** 지금 단계가 시작된 시각 */
  stepAt?: number;
  /** 같은 단계가 지난번까지 걸린 시간(중앙값) — 진행 막대의 기준. 처음이면 없다 */
  expectMs?: number;
  /** 마지막으로 들어온 활동 신호. at 이 오래되면 멈춘 것이다 */
  activity?: { label: string; at: number };
  progress?: { done: number; total: number };
  lines: string[];
  error?: string;
  costUsd: number;
};

export type Ctx = {
  log: (line: string) => void;
  step: (label: string) => void;
  progress: (done: number, total: number) => void;
  /** 지금 하는 일 (label 없으면 살아 있다는 신호만) */
  activity: (label?: string) => void;
  cost: (usd: number) => void;
  /** 저장소 루트에서 명령 실행 — 출력은 작업 로그로. 실패하면 마지막 출력을 담아 던진다 */
  sh: (cmd: string, args: string[], env?: Record<string, string>) => Promise<string>;
};

let running: Job | null = null;

/**
 * 단계별 걸린 시간 기록 (.studio/durations.json, 단계 이름 → 최근 5회 ms).
 * Claude 호출은 진행률을 알 수 없어서, 지난번 걸린 시간을 기준으로 막대를 채운다.
 */
const DURATIONS = path.join(STATE, 'durations.json');
const MIN_RECORD_MS = 3000;

export function expectedMs(step: string): number | undefined {
  const xs = readJsonFile<Record<string, number[]>>(DURATIONS, {})[step];
  if (!xs?.length) return undefined;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function recordDuration(step: string, ms: number) {
  if (ms < MIN_RECORD_MS) return; // 할 일이 없어 바로 넘어간 단계는 기준을 망친다
  const all = readJsonFile<Record<string, number[]>>(DURATIONS, {});
  all[step] = [...(all[step] ?? []), Math.round(ms)].slice(-5);
  writeJsonFile(DURATIONS, all);
}
const fileOf = (slug: string) => path.join(studioDir(slug), 'job.json');

export function jobOf(slug: string): Job | null {
  if (running?.slug === slug) return running;
  const j = readJsonFile<Job | null>(fileOf(slug), null);
  // 서버가 재시작되면 돌던 작업은 사라진다 — 그 사실을 보여준다
  if (j?.state === 'running') return { ...j, state: 'error', error: '서버가 다시 시작되어 작업이 멈췄다. 다시 실행한다.' };
  return j;
}

export const busy = () => running;

async function notify(job: Job) {
  if (!NTFY_TOPIC) return;
  const ok = job.state === 'done';
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: encodeURIComponent(`TaleFrame · ${job.slug}`), Tags: ok ? 'white_check_mark' : 'warning' },
    body: ok ? `${job.title} 끝` : `${job.title} 실패: ${job.error ?? ''}`.slice(0, 300),
  }).catch(() => {});
}

export function startJob(slug: string, kind: string, title: string, fn: (ctx: Ctx) => Promise<void>): Job | { busy: Job } {
  if (running) return { busy: running };
  const job: Job = { slug, kind, title, state: 'running', startedAt: Date.now(), lines: [], costUsd: 0 };
  running = job;
  let saveTimer: NodeJS.Timeout | null = null;
  const save = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeJsonFile(fileOf(slug), job);
    }, 500);
  };
  const ctx: Ctx = {
    log: (line) => {
      job.lines.push(line);
      if (job.lines.length > 80) job.lines.splice(0, job.lines.length - 80);
      save();
    },
    step: (label) => {
      const now = Date.now();
      if (job.step && job.stepAt) recordDuration(job.step, now - job.stepAt);
      job.step = label;
      job.stepAt = now;
      job.expectMs = expectedMs(label);
      job.activity = undefined;
      job.progress = undefined;
      ctx.log(`▸ ${label}`);
    },
    activity: (label) => {
      job.activity = { label: label ?? job.activity?.label ?? '진행 중', at: Date.now() };
      save();
    },
    progress: (done, total) => {
      job.progress = { done, total };
      save();
    },
    cost: (usd) => {
      job.costUsd += usd;
      save();
    },
    sh: (cmd, args, env) =>
      new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
        let all = '';
        const take = (d: Buffer) => {
          const s = d.toString();
          all += s;
          for (const l of s.split('\n')) if (l.trim()) ctx.log(l.trimEnd().slice(0, 200));
        };
        p.stdout.on('data', take);
        p.stderr.on('data', take);
        p.on('error', reject);
        p.on('close', (code) => (code === 0 ? resolve(all) : reject(new Error(`${cmd} ${args.slice(0, 3).join(' ')} 실패 (${code})\n${all.slice(-600)}`))));
      }),
  };
  writeJsonFile(fileOf(slug), job);
  fn(ctx)
    .then(() => {
      job.state = 'done';
      if (job.step && job.stepAt) recordDuration(job.step, Date.now() - job.stepAt); // 실패한 단계는 기록하지 않는다
    })
    .catch((e: Error) => {
      job.state = 'error';
      job.error = e.message.slice(0, 1200);
      ctx.log(`✗ ${e.message.split('\n')[0]}`);
    })
    .finally(() => {
      job.endedAt = Date.now();
      running = null;
      writeJsonFile(fileOf(slug), job);
      // 여행별 Claude 사용량 누계 (구독이면 청구되지 않지만 한도를 가늠하는 데 쓴다)
      const usageFile = path.join(studioDir(slug), 'usage.json');
      const u = readJsonFile<{ usd: number; jobs: number }>(usageFile, { usd: 0, jobs: 0 });
      writeJsonFile(usageFile, { usd: Math.round((u.usd + job.costUsd) * 1000) / 1000, jobs: u.jobs + 1 });
      void notify(job);
    });
  return job;
}
