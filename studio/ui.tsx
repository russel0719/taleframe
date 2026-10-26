/** @jsxImportSource hono/jsx */
import type { Child, FC } from 'hono/jsx';
import type { Job } from './jobs';
import type { PlanStep, Question } from './prompts';
import { STEPS, currentStep, stepDone, type TripState } from './trip';

/**
 * 폰 화면. 서버에서 그리고, 업로드·폴링·폼 전송만 /static/app.js 가 한다.
 * 절차가 화면의 뼈대다 — 위쪽 단계 레일이 항상 보이고, 지금 할 일 하나만 카드로 크게 보인다.
 */

const mb = (b: number) => `${(b / 1048576).toFixed(b > 100 * 1048576 ? 0 : 1)}MB`;

export const Layout: FC<{ title: string; children?: Child }> = ({ title, children }) => (
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="theme-color" content="#f5f5f7" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="TaleFrame" />
      <title>{title}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <link rel="stylesheet" href="/static/app.css" />
      <script src="/static/app.js" defer></script>
    </head>
    <body>
      <header class="bar">
        <a href="/" class="brand">
          TaleFrame <span>Studio</span>
        </a>
      </header>
      <main class="wrap">{children}</main>
    </body>
  </html>
);

export const TripsPage: FC<{ trips: TripState[] }> = ({ trips }) => (
  <Layout title="TaleFrame Studio">
    <section class="card">
      <h1>새 여행</h1>
      <p class="muted">이름은 나중에 페이지 제목과 따로 정한다. 주소는 게시 링크가 된다 (…/stories/주소/) — 영문 소문자·숫자·하이픈.</p>
      <form data-api="/api/trips" data-go="slug" class="stack">
        <input name="name" placeholder="이름 — 예: 다카마쓰 2026" autocomplete="off" />
        <input
          name="address"
          placeholder="주소 — 예: takamatsu-2026"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          pattern="[a-zA-Z0-9\- ]*"
        />
        <button class="pill">만들기</button>
      </form>
    </section>
    {trips.map((t) => {
      const cur = currentStep(t);
      const step = STEPS.find((s) => s.id === cur)!;
      return (
        <a class="card trip" href={`/t/${t.slug}`}>
          <div>
            <h2>{t.name}</h2>
            <p class="muted">
              {t.published ? '게시됨' : `${STEPS.indexOf(step) + 1}/${STEPS.length} · ${step.title}`}
              {t.job?.state === 'running' ? ' · 작업 중' : ''}
            </p>
          </div>
          <span class="chev">›</span>
        </a>
      );
    })}
  </Layout>
);

const Rail: FC<{ s: TripState }> = ({ s }) => {
  const cur = currentStep(s);
  return (
    <ol class="rail">
      {STEPS.map((st, i) => (
        <li class={stepDone(s, st.id) ? 'done' : st.id === cur ? 'now' : ''}>
          <span class="num">{stepDone(s, st.id) ? '✓' : i + 1}</span>
          <span class="lbl">{st.title}</span>
        </li>
      ))}
    </ol>
  );
};

const Thumbs: FC<{ slug: string; ids: string[]; big?: boolean }> = ({ slug, ids, big }) =>
  ids.length ? (
    <div class={big ? 'thumbs big' : 'thumbs'}>
      {ids.map((id) => (
        <a href={`/t/${slug}/thumb/${id}`} target="_blank">
          <img src={`/t/${slug}/thumb/${id}`} alt={id} loading="lazy" />
        </a>
      ))}
    </div>
  ) : null;

/** <script type=application/json> 안에 넣을 작업 상태 — 로그는 빼고, </script> 로 끊기지 않게 */
const jobJson = (job: Job) =>
  JSON.stringify({ step: job.step, stepAt: job.stepAt, expectMs: job.expectMs, activity: job.activity, progress: job.progress, now: Date.now() }).replace(/</g, '\\u003c');

const JobCard: FC<{ job: Job; slug: string }> = ({ job, slug }) => {
  const running = job.state === 'running';
  const pct = job.progress ? Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100) : null;
  return (
    <section class={`card job ${job.state}`} {...(running ? { 'data-poll': `/api/t/${slug}/job` } : {})}>
      <h2>
        {running ? '⏳ ' : job.state === 'done' ? '✓ ' : '⚠ '}
        {job.title}
      </h2>
      <p class="step" data-field="step">
        {job.step ?? ''}
        {pct !== null ? ` · ${pct}%` : ''}
      </p>
      {running ? (
        // 막대·경과 시간·지금 하는 일은 app.js 가 1초마다 다시 그린다 (data-job 이 첫 상태)
        <>
          <div class="meter wait" data-field="meter">
            <div />
          </div>
          <p class="eta" data-field="eta" />
          <p class="now" data-field="activity" />
          <script type="application/json" data-field="job" dangerouslySetInnerHTML={{ __html: jobJson(job) }} />
        </>
      ) : (
        pct !== null && (
          <div class="meter">
            <div style={`width:${pct}%`} />
          </div>
        )
      )}
      {running && <p class="muted">화면을 닫아도 PC 에서 계속 돈다. 다시 열면 이어서 보인다.</p>}
      {job.state === 'error' && (
        <>
          <pre class="err">{job.error}</pre>
          <form data-api={`/api/t/${slug}/retry`}>
            <button class="pill">다시 실행</button>
          </form>
        </>
      )}
      <details>
        <summary>작업 기록</summary>
        <pre class="log" data-field="log">
          {job.lines.slice(-25).join('\n')}
        </pre>
      </details>
    </section>
  );
};

const UploadCard: FC<{ s: TripState; open: boolean }> = ({ s, open }) => (
  <details class="card" open={open}>
    <summary>
      <h2>사진·영상 올리기</h2>
      <span class="muted">
        올린 것: 사진 {s.inbox.images} · 영상 {s.inbox.videos} · {mb(s.inbox.bytes)}
      </span>
    </summary>
    <p class="muted">
      집 와이파이에서만 된다. 올리는 동안 화면을 켜 둔다 — 끊기면 같은 파일을 다시 고르면 이어서 올린다.
      아이폰은 사진 고르기의 <b>옵션 → 위치 포함</b>을 켜 두면 장소 후보가 더 정확해진다.
    </p>
    <input type="file" id="files" multiple accept="image/*,video/*,.heic,.heif,.mov" data-slug={s.slug} />
    <ul class="uploads" id="uploads"></ul>
  </details>
);

const PHASE_LABEL: Record<string, string> = { photos: '① 사진 질문', direction: '② 웹 방향', gaps: '⑤ 보완 질문' };

const QuestionFields: FC<{ slug: string; questions: Question[] }> = ({ slug, questions }) => (
  <>
    {questions.map((q) => (
      <fieldset class="q" data-q={q.id}>
        <legend>
          <span class="tag">{q.header}</span>
          {q.question}
        </legend>
        <Thumbs slug={slug} ids={q.media} big />
        <div class="opts">
          {q.options.map((o) => (
            <label class="opt">
              <input type={q.multiSelect ? 'checkbox' : 'radio'} name={q.id} value={o.label} />
              <span>
                <b>{o.label}</b>
                {o.description && <small>{o.description}</small>}
              </span>
            </label>
          ))}
        </div>
        <textarea name={`${q.id}__text`} rows={2} placeholder="직접 쓰기 (받아쓰기도 된다)"></textarea>
      </fieldset>
    ))}
  </>
);

const Questions: FC<{ s: TripState; phase: string; message: string; questions: Question[] }> = ({ s, phase, message, questions }) => (
  <form class="card" data-api={`/api/t/${s.slug}/answers`} data-kind="answers">
    <p class="phase">{PHASE_LABEL[phase] ?? ''}</p>
    <p class="lead">{message}</p>
    <QuestionFields slug={s.slug} questions={questions} />
    <button class="pill wide">답 보내기</button>
  </form>
);

const Plan: FC<{ s: TripState; step: PlanStep }> = ({ s, step }) => {
  const plan = step.plan;
  return (
    <section class="card">
      <p class="phase">③ 레이아웃</p>
      <p class="lead">{step.message}</p>
      <h2>{plan.title}</h2>
      <ol class="outline">
        {plan.outline.map((o) => (
          <li>{o}</li>
        ))}
      </ol>
      <ul class="plan">
        {plan.rows.map((r, i) => (
          <li>
            <div class="plan-head">
              <span class="no">{i + 1}</span>
              <span class={`kind ${r.kind === '작품' ? 'art' : ''}`}>{r.kind}</span>
              <code>{r.template}</code>
            </div>
            <Thumbs slug={s.slug} ids={r.media} />
            <p class="muted">{r.why}</p>
          </li>
        ))}
      </ul>
      <form data-api={`/api/t/${s.slug}/plan`} data-kind="plan-approve">
        <input type="hidden" name="approve" value="1" />
        <button class="pill wide">이대로 좋아요</button>
      </form>
      <form data-api={`/api/t/${s.slug}/plan`} data-kind="plan-change" class="stack">
        <textarea name="text" rows={3} placeholder="이렇게 바꿔 주세요 (예: 지도는 빼고, 음식 사진을 더)"></textarea>
        <button class="pill ghost wide">바꿔 달라고 보내기</button>
      </form>
    </section>
  );
};

const Review: FC<{ s: TripState }> = ({ s }) => (
  <section class="card">
    <p class="phase">④ 초안 확인{s.gaps ? ' · ⑤ 보완 질문' : ''}</p>
    <h2>초안이 나왔다</h2>
    <p class="muted">게시본과 같은 화면이다. 먼저 초안을 보고, 아래 질문에 답하거나 섹션마다 괜찮다/고쳐 달라를 고른다.</p>
    <a class="pill wide" href={`/preview/stories/${s.slug}/`} target="_blank">
      초안 미리보기 열기
    </a>
    <form data-api={`/api/t/${s.slug}/review`} data-kind="review">
      {s.gaps && (
        <div class="gaps">
          <p class="lead">{s.gaps.message}</p>
          <QuestionFields slug={s.slug} questions={s.gaps.questions} />
        </div>
      )}
      <h3 class="sub">섹션별 확인</h3>
      <ul class="sections">
        {s.sections.map((sec, i) => (
          <li class={sec.status === 'approved' ? 'ok' : ''}>
            <label class="sec-head">
              <input type="checkbox" name="approve" value={sec.id} checked={sec.status === 'approved'} />
              <span class="no">{i + 1}</span>
              <code>{sec.template}</code>
              {sec.locked && <span class="tag">잠금</span>}
            </label>
            {sec.label && <p class="sec-label">{sec.label}</p>}
            {sec.memo?.startsWith('보완') && <p class="memo">{sec.memo}</p>}
            <Thumbs slug={s.slug} ids={sec.media} />
            <a class="anchor" href={`/preview/stories/${s.slug}/#${sec.id}`} target="_blank">
              이 섹션 보기 ›
            </a>
            <textarea name={`req__${sec.id}`} rows={1} placeholder="고칠 점 (비우면 그대로)"></textarea>
          </li>
        ))}
      </ul>
      <button class="pill wide">보내기</button>
      <button class="pill ghost wide" name="all" value="1">
        전부 괜찮아요 (전체 승인)
      </button>
    </form>
  </section>
);

const Publish: FC<{ s: TripState }> = ({ s }) => (
  <section class="card">
    <h2>게시</h2>
    {s.published ? (
      <>
        <p>
          게시했다 — <a href={s.published.url}>{s.published.url}</a>
        </p>
        <p class="muted">고치려면 이 화면의 미리보기 확인에서 다시 요청하면 된다.</p>
      </>
    ) : (
      <form data-api={`/api/t/${s.slug}/publish`} data-kind="publish" class="stack">
        <p>
          섹션 {s.sections.length}개가 모두 승인됐다. 게시하면 사진·영상이 <b>공개 GitHub 저장소와 사이트에 올라가 누구나 볼 수 있다.</b>
        </p>
        <label class="opt">
          <input type="checkbox" name="confirm" value="1" required />
          <span>공개되는 것을 확인했다</span>
        </label>
        <button class="pill wide">공개 게시</button>
      </form>
    )}
  </section>
);

const Action: FC<{ s: TripState; api: string; label: string; note: string }> = ({ s, api, label, note }) => (
  <section class="card">
    <p>{note}</p>
    <form data-api={`/api/t/${s.slug}/${api}`}>
      <button class="pill wide">{label}</button>
    </form>
  </section>
);

export const TripPage: FC<{ s: TripState }> = ({ s }) => {
  const cur = currentStep(s);
  const running = s.job?.state === 'running';
  const est = Math.max(1, Math.round(((s.analysis.total - s.analysis.done || s.inbox.files.length) * 6) / 60));
  let body: Child = null;
  if (running || s.job?.state === 'error') body = null;
  else if (cur === 'upload') body = null;
  else if (cur === 'prepare')
    body = (
      <Action
        s={s}
        api="prepare"
        label="정리·훑어보기 시작"
        note={`사진 ${s.inbox.images}장·영상 ${s.inbox.videos}개를 시각순으로 정리하고 한 장씩 훑어본다. 약 ${est}분. 끝나면 첫 질문이 나온다.`}
      />
    );
  else if ((cur === 'photos' || cur === 'direction') && s.pending && s.pending.phase !== 'layout' && s.pending.questions?.length)
    body = <Questions s={s} phase={s.pending.phase} message={s.pending.message} questions={s.pending.questions} />;
  else if (cur === 'photos' || cur === 'direction')
    body = <Action s={s} api="next" label="질문 받기" note={cur === 'photos' ? '사진을 보고 확인할 것들을 묻는다.' : '어떤 페이지로 만들지 묻는다.'} />;
  else if (cur === 'layout' && s.pending?.phase === 'layout') body = <Plan s={s} step={s.pending} />;
  else if (cur === 'layout') body = <Action s={s} api="next" label="레이아웃 제안 받기" note="답한 내용으로 아웃라인과 섹션 배치를 짠다." />;
  else if (cur === 'draft')
    body = <Action s={s} api="build" label="초안 만들기" note="승인한 배치대로 초안을 쓰고, 사진·영상을 변환하고, 미리보기를 만든다. 모르는 곳은 비워 두고 다음에 묻는다. 5~10분." />;
  else if (cur === 'review') body = <Review s={s} />;
  else body = <Publish s={s} />;

  return (
    <Layout title={`${s.name} · TaleFrame Studio`}>
      <h1 class="title">{s.name}</h1>
      <Rail s={s} />
      {s.job && (running || s.job.state === 'error' || Date.now() - (s.job.endedAt ?? 0) < 60_000) && <JobCard job={s.job} slug={s.slug} />}
      {body}
      {s.skipped.length > 0 && (
        <details class="card">
          <summary>
            <span class="muted">읽지 못한 파일 {s.skipped.length}개</span>
          </summary>
          <ul class="muted">
            {s.skipped.map((k) => (
              <li>
                {k.file}: {k.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!s.published && <UploadCard s={s} open={cur === 'upload'} />}
      {s.travelPlan && (
        <p class="muted usage">
          여행 계획(travel-plan): {s.travelPlan.title} — 계획대로 맞춘 곳 {s.travelPlan.confirm}곳은 한 번에 확인, 어긋난 {s.travelPlan.ask}묶음만 따로 묻는다
          {s.travelPlan.outside > 0 ? ` · 계획 밖 사진 ${s.travelPlan.outside}장` : ''}
        </p>
      )}
      {s.usage.jobs > 0 && (
        <p class="muted usage">
          이 여행의 Claude 사용량 ≈ ${s.usage.usd.toFixed(2)} (작업 {s.usage.jobs}번 · 구독이면 청구되지 않고 한도에서 빠진다)
        </p>
      )}
      {s.interview.length > 0 && (
        <details class="card">
          <summary>
            <span class="muted">지금까지 답한 것 {s.interview.length}개</span>
          </summary>
          <ul class="answers">
            {s.interview.map((x) => (
              <li>
                <span class="tag">{x.at}</span> {x.a}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Layout>
  );
};

export const ConnectPage: FC<{ url: string; svg: string; firewallHint: boolean }> = ({ url, svg, firewallHint }) => (
  <Layout title="폰 연결 · TaleFrame Studio">
    <section class="card center">
      <h1>폰으로 연결</h1>
      <p>폰을 같은 와이파이에 두고 카메라로 찍는다. 한 번 들어오면 폰이 기억한다.</p>
      <div class="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <p class="muted">
        <code>{url.replace(/\?k=.*/, '')}</code>
      </p>
      {firewallHint && (
        <p class="muted">
          폰에서 안 열리면 Windows 방화벽 규칙이 없는 것이다 — WSL 에서 <code>scripts/studio-lan.sh</code> 를 한 번 실행한다.
        </p>
      )}
    </section>
  </Layout>
);

export const DeniedPage: FC = () => (
  <Layout title="TaleFrame Studio">
    <section class="card center">
      <h1>잠겨 있다</h1>
      <p>PC 에서 Studio 화면(연결 페이지)의 QR 을 폰으로 찍어 들어온다.</p>
    </section>
  </Layout>
);
