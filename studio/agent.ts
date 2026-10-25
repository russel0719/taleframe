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
  timeoutMs?: number;
};

const SYSTEM = `너는 TaleFrame 여행 후기 제작 파이프라인의 한 단계를 맡는다. 사용자는 폰 화면으로 결과를 본다.
- 저장소: 이 디렉토리. 규칙의 원본은 .claude/skills/travel-story/ 의 SKILL.md · interview.md · composition.md 다. 지시가 있으면 반드시 Read 로 읽고 따른다.
- 절대 규칙: 감정·사건·가게 이름·가격·지명을 지어내지 않는다. 사용자가 말했거나 확인한 것만 쓴다. 사진만 보고 짐작한 것은 질문 선택지로만 쓴다.
- 이 사이트는 완전 공개다. 숙소 좌표는 어디에도 넣지 않는다 (work/<slug>/places.json 의 lodging 지점).
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
    '--output-format', 'json',
    '--json-schema', JSON.stringify(jsonSchema),
    '--tools', tools.join(','),
    '--allowedTools', ...allowed,
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--append-system-prompt', SYSTEM,
    ...(model ? ['--model', model] : []),
  ];
}

function once<T>(o: Options<T>): Promise<AgentResult<T>> {
  return new Promise((resolve, reject) => {
    const p = spawn('claude', args(o), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => p.kill('SIGTERM'), o.timeoutMs ?? 20 * 60_000);
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => reject(e));
    p.on('close', (code) => {
      clearTimeout(timer);
      const text = Buffer.concat(out).toString();
      let j: { is_error?: boolean; subtype?: string; result?: string; structured_output?: unknown; total_cost_usd?: number; num_turns?: number; session_id?: string };
      try {
        j = JSON.parse(text);
      } catch {
        reject(new Error(`claude 출력이 JSON 이 아니다 (code ${code}): ${(Buffer.concat(err).toString() || text).slice(-400)}`));
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
