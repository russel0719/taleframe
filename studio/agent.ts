import { spawn } from 'node:child_process';
import { z } from 'zod';
import { MODEL, ROOT } from './config';

/**
 * headless Claude 한 번 호출.
 *
 * - 응답은 `--json-schema` 로 받아 `structured_output` 을 zod 로 다시 검증한다 (본문 텍스트를 파싱하지 않는다)
 * - MCP 서버·스킬 목록을 싣지 않고 도구를 필요한 것만 준다 — 실측: 같은 호출이 $0.34 → $0.07~0.09
 * - 쓰기 권한은 그 여행의 work/ 와 content/stories/ 로 한정, Bash 는 `npm run tf` 만. git push 같은 게시는 서버 코드가 한다
 * - 스키마 위반·실패는 한 번 다시 시도한다
 * - stream-json 으로 받아 지금 하는 일(읽는 파일·실행 명령·답 쓰는 중)을 `activity` 로 흘린다 — 폰에서 멈췄는지 알 수 있게
 */
export type AgentResult<T> = { data: T; costUsd: number; turns: number; sessionId: string };

type Options<T> = {
  prompt: string;
  schema: z.ZodType<T>;
  slug: string;
  model?: string;
  /** Bash(npm run tf) · 쓰기 도구를 줄지 */
  write?: boolean;
  log?: (line: string) => void;
  /** 지금 하는 일. label 없이 부르면 "아직 살아 있다"는 신호만 */
  activity?: (label?: string) => void;
  timeoutMs?: number;
};

const SYSTEM = `너는 TaleFrame 여행 후기 제작 파이프라인의 한 단계를 맡는다. 사용자는 폰 화면으로 결과를 본다.
- 저장소: 이 디렉토리. 규칙의 원본은 .claude/skills/travel-story/ 의 SKILL.md · interview.md · composition.md 다. 지시가 있으면 반드시 Read 로 읽고 따른다.
- 절대 규칙: 감정·사건·가게 이름·가격·지명을 지어내지 않는다. 사용자가 말했거나 확인한 것만 쓴다. 사진만 보고 짐작한 것은 질문 선택지로만 쓴다.
- 이 사이트는 완전 공개다. 숙소 위치는 써도 된다(사용자 결정). 일행이 아닌 사람 얼굴은 물어본 뒤에만.
- 응답은 주어진 JSON 스키마로만 한다. 한국어로 쓴다.`;

function args<T>(o: Options<T>) {
  // CLI 의 스키마 검증기는 draft 2020-12 의 "$schema" 선언을 모른다 ("no schema with key or ref") — 선언만 뺀다
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(o.schema, { unrepresentable: 'any' }) as Record<string, unknown>;
  void _drop;
  const tools = o.write ? ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] : ['Read', 'Glob', 'Grep'];
  const allowed = ['Read', 'Glob', 'Grep'];
  if (o.write) {
    allowed.push(
      `Write(work/${o.slug}/**)`,
      `Edit(work/${o.slug}/**)`,
      `Write(content/stories/${o.slug}/**)`,
      `Edit(content/stories/${o.slug}/**)`,
      'Bash(npm run tf:*)',
      'Bash(npm run -s tf:*)',
    );
  }
  const model = o.model ?? MODEL;
  return [
    '-p', o.prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--json-schema', JSON.stringify(jsonSchema),
    '--tools', tools.join(','),
    '--allowedTools', ...allowed,
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--append-system-prompt', SYSTEM,
    ...(model ? ['--model', model] : []),
  ];
}

type ResultEvent = { type: 'result'; is_error?: boolean; subtype?: string; result?: string; structured_output?: unknown; total_cost_usd?: number; num_turns?: number; session_id?: string };
type ToolUse = { type: 'tool_use'; name: string; input: Record<string, unknown> };

const short = (p: unknown) => String(p ?? '').split('/').slice(-2).join('/');

/** 도구 호출 → 폰에 보일 한 줄 */
export function describeTool(t: ToolUse): string {
  switch (t.name) {
    case 'Read':
      return `읽는 중 · ${short(t.input.file_path)}`;
    case 'Write':
    case 'Edit':
      return `쓰는 중 · ${short(t.input.file_path)}`;
    case 'Bash':
      return `실행 · ${String(t.input.command ?? '').replace(/^npm run (-s )?tf --?/, 'tf').slice(0, 60)}`;
    case 'Glob':
    case 'Grep':
      return `찾는 중 · ${String(t.input.pattern ?? '').slice(0, 40)}`;
    case 'StructuredOutput':
      return '답 정리 끝';
    default:
      return t.name;
  }
}

/** stream-json 한 줄을 읽어 활동을 알리고, 마지막 result 이벤트를 돌려준다 */
export function watchStream<T>(o: Pick<Options<T>, 'log' | 'activity'>) {
  let result: ResultEvent | null = null;
  let answerChars = 0;
  let lastLabelAt = 0;
  const say = (label?: string) => o.activity?.(label);
  return {
    line(raw: string) {
      let e: { type?: string; event?: { type?: string; content_block?: { type?: string; name?: string }; delta?: { type?: string; partial_json?: string; text?: string } }; message?: { content?: { type: string }[] } };
      try {
        e = JSON.parse(raw);
      } catch {
        return;
      }
      if (e.type === 'result') result = e as ResultEvent;
      else if (e.type === 'assistant') {
        for (const b of e.message?.content ?? []) {
          if (b.type !== 'tool_use') continue;
          const label = describeTool(b as ToolUse);
          o.log?.(`  · ${label}`);
          say(label);
        }
      } else if (e.type === 'stream_event') {
        const ev = e.event;
        if (ev?.type === 'content_block_start') {
          const cb = ev.content_block;
          if (cb?.type === 'thinking') say('생각하는 중');
          else if (cb?.type === 'tool_use' && cb.name === 'StructuredOutput') {
            answerChars = 0;
            say('답 쓰는 중');
          } else say();
        } else if (ev?.delta?.type === 'input_json_delta') {
          // 레이아웃·질문은 마지막 답(StructuredOutput)을 길게 쓴다 — 글자 수로 진행을 보여준다 (1초에 한 번)
          answerChars += ev.delta.partial_json?.length ?? 0;
          const now = Date.now();
          if (now - lastLabelAt > 1000) {
            lastLabelAt = now;
            say(`답 쓰는 중 · ${answerChars.toLocaleString('ko-KR')}자`);
          }
        } else say();
      } else say(); // 도구 결과·생각 토큰 같은 나머지 이벤트도 살아 있다는 신호다
    },
    result: () => result as ResultEvent | null,
  };
}

function once<T>(o: Options<T>): Promise<AgentResult<T>> {
  return new Promise((resolve, reject) => {
    const p = spawn('claude', args(o), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const w = watchStream(o);
    let buf = '';
    let tail = '';
    const err: Buffer[] = [];
    const timer = setTimeout(() => p.kill('SIGTERM'), o.timeoutMs ?? 20 * 60_000);
    o.activity?.('Claude 시작');
    p.stdout.on('data', (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const l of lines) if (l.trim()) w.line(l);
      tail = (tail + d.toString()).slice(-400);
    });
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => reject(e));
    p.on('close', (code) => {
      clearTimeout(timer);
      if (buf.trim()) w.line(buf);
      const j = w.result();
      if (!j) {
        reject(new Error(`claude 가 결과 없이 끝났다 (code ${code}): ${(Buffer.concat(err).toString() || tail).slice(-400)}`));
        return;
      }
      if (j.is_error || j.subtype !== 'success') {
        reject(new Error(`claude 실패 (${j.subtype}): ${String(j.result ?? '').slice(0, 400)}`));
        return;
      }
      const parsed = o.schema.safeParse(j.structured_output);
      if (!parsed.success) {
        reject(new Error(`응답이 스키마와 다르다: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`));
        return;
      }
      resolve({ data: parsed.data, costUsd: j.total_cost_usd ?? 0, turns: j.num_turns ?? 0, sessionId: j.session_id ?? '' });
    });
  });
}

export async function runClaude<T>(o: Options<T>): Promise<AgentResult<T>> {
  try {
    return await once(o);
  } catch (e) {
    o.log?.(`· 다시 시도: ${(e as Error).message}`);
    return await once({ ...o, prompt: `${o.prompt}\n\n(이전 시도가 실패했다: ${(e as Error).message}. 스키마를 정확히 지킨다.)` });
  }
}
