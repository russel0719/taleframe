// TaleFrame Studio — 폰 쪽 스크립트: 업로드(32MB 청크, 이어 올리기) · 폼 전송 · 작업 폴링
// 사진 대부분이 한 번에 가는 크기. 서버는 청크를 메모리로 받는다
const CHUNK = 32 * 1024 * 1024;
// 화면이 꺼졌다 켜지면 iOS 가 멈춰 둔 요청이 응답 없이 남는다 — 오래 걸리면 끊고 다시 보낸다
const CHUNK_TIMEOUT = 60_000;

/** 질문 카드(fieldset[data-q])의 답 — 질문 단계와 초안 확인(보완 질문)이 함께 쓴다 */
function collectAnswers(form) {
  const answers = {};
  for (const fs of form.querySelectorAll('fieldset[data-q]')) {
    const id = fs.dataset.q;
    const choices = [...fs.querySelectorAll(`input[name="${id}"]:checked`)].map((i) => i.value);
    const text = fs.querySelector(`textarea[name="${id}__text"]`)?.value ?? '';
    if (choices.length || text.trim()) answers[id] = { choices, text };
  }
  return answers;
}

function formPayload(form, submitter) {
  const kind = form.dataset.kind;
  if (kind === 'answers') return { answers: collectAnswers(form) };
  if (kind === 'review') {
    const answers = collectAnswers(form);
    const approve = [...form.querySelectorAll('input[name="approve"]:checked')].map((i) => i.value);
    const requests = [...form.querySelectorAll('textarea[name^="req__"]')]
      .map((t) => ({ section: t.name.slice(5), text: t.value }))
      .filter((r) => r.text.trim());
    return { approve, requests, answers, all: submitter?.name === 'all' ? '1' : undefined };
  }
  return Object.fromEntries(new FormData(form));
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-api]');
  if (!form) return;
  e.preventDefault();
  const buttons = form.querySelectorAll('button');
  buttons.forEach((b) => (b.disabled = true));
  try {
    const res = await fetch(form.dataset.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formPayload(form, e.submitter)),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) throw new Error(j.error || `실패 (${res.status})`);
    if (form.dataset.go === 'slug' && j.slug) location.href = `/t/${j.slug}`;
    else location.reload();
  } catch (err) {
    alert(err.message);
    buttons.forEach((b) => (b.disabled = false));
  }
});

// ── 업로드 ──────────────────────────────────────────────────
async function uploadFile(slug, file, row) {
  let offset = 0;
  for (let tries = 0; offset < file.size; ) {
    const end = Math.min(file.size, offset + CHUNK);
    const q = new URLSearchParams({ name: file.name, size: String(file.size), offset: String(offset) });
    let res;
    try {
      // iOS Safari 는 사진 앱에서 고른 파일을 중간부터 자른 Blob 을 그대로 body 로 주면 전송이 멈춘다
      // (첫 조각만 가고 두 번째에서 응답 없음, 2026-10 실측) — 먼저 메모리로 읽어서 보낸다
      const body = await file.slice(offset, end).arrayBuffer();
      res = await fetch(`/api/t/${slug}/upload?${q}`, {
        method: 'PUT',
        body,
        signal: AbortSignal.timeout(CHUNK_TIMEOUT),
      });
    } catch {
      if (++tries > 5) throw new Error('연결이 끊겼다');
      await new Promise((r) => setTimeout(r, 1500 * tries));
      continue;
    }
    const j = await res.json().catch(() => ({}));
    if (res.status === 409) {
      offset = j.received; // 서버가 가진 데까지 받았다 — 거기서부터 이어 보낸다
      continue;
    }
    if (!res.ok) throw new Error(j.message || `실패 (${res.status})`);
    offset = j.received;
    tries = 0;
    row.querySelector('.bar i').style.width = `${Math.round((offset / file.size) * 100)}%`;
  }
}

/** 올리는 동안 화면이 꺼지지 않게 (Safari 16.4+). 탭을 벗어났다 돌아오면 다시 잡는다 */
let wakeLock = null;
let uploading = false;
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* 지원하지 않거나 거절 — 안내 문구로 대신한다 */
  }
}
document.addEventListener('visibilitychange', () => {
  if (uploading && document.visibilityState === 'visible') keepAwake();
});

const input = document.getElementById('files');
if (input) {
  input.addEventListener('change', async () => {
    const slug = input.dataset.slug;
    const files = [...input.files];
    if (!files.length) return;
    const list = document.getElementById('uploads');
    const check = await fetch(`/api/t/${slug}/upload/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: files.map((f) => ({ name: f.name, size: f.size })) }),
    }).then((r) => r.json());
    const skip = new Set(check.skip);
    input.disabled = true;
    uploading = true;
    keepAwake();
    const stat = document.createElement('p');
    stat.className = 'muted';
    list.before(stat);
    let done = 0;
    let failed = 0;
    let n = 0;
    for (const f of files) {
      stat.textContent = `${++n}/${files.length}장째 · 이미 있는 ${skip.size}장은 건너뜀`;
      const li = document.createElement('li');
      li.innerHTML = `<span class="name"></span><span class="bar"><i></i></span>`;
      li.querySelector('.name').textContent = f.name;
      list.prepend(li);
      if (skip.has(f.name)) {
        li.classList.add('skip');
        li.querySelector('.bar i').style.width = '100%';
        continue;
      }
      try {
        await uploadFile(slug, f, li);
        li.classList.add('ok');
        done++;
      } catch (err) {
        li.classList.add('fail');
        li.querySelector('.name').textContent = `${f.name} — ${err.message}`;
        failed++;
      }
    }
    input.disabled = false;
    uploading = false;
    wakeLock?.release().catch(() => {});
    if (!failed) location.reload();
    else alert(`${done}개 올림, ${failed}개 실패 — 같은 파일을 다시 고르면 이어서 올린다`);
  });
}

// ── 작업 진행 ────────────────────────────────────────────────
// Claude 호출은 진행률을 모른다 — 지난번 같은 단계가 걸린 시간(expectMs)으로 막대를 채우고,
// 마지막 활동 신호가 몇 초 전인지 보여 줘서 "도는 중"과 "멈춤"을 구분한다
const QUIET_MS = 90_000;

function dur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
}

function renderJob(card, job, skew) {
  const now = Date.now() + skew;
  const pct = job.progress ? Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100) : null;
  card.querySelector('[data-field="step"]').textContent = `${job.step ?? ''}${pct !== null ? ` · ${pct}%` : ''}`;
  const meter = card.querySelector('[data-field="meter"]');
  const eta = card.querySelector('[data-field="eta"]');
  const act = card.querySelector('[data-field="activity"]');
  if (!meter || !eta || !act) return;
  const elapsed = job.stepAt ? now - job.stepAt : 0;
  let width = null;
  let text = job.stepAt ? `${dur(elapsed)} 지남` : '';
  if (pct !== null) {
    width = pct;
    if (job.progress.done > 0 && pct < 100) text += ` · 약 ${dur((elapsed / job.progress.done) * (job.progress.total - job.progress.done))} 남음`;
  } else if (job.expectMs) {
    const r = elapsed / job.expectMs;
    width = Math.min(95, Math.round(r * 100)); // 끝나기 전에는 다 채우지 않는다
    text += r < 1 ? ` · 보통 ${dur(job.expectMs)} 걸린다` : ` · 지난번(${dur(job.expectMs)})보다 오래 걸리는 중`;
  } else if (job.stepAt) {
    text += ' · 처음 하는 단계라 예상 시간을 모른다';
  }
  meter.classList.toggle('wait', width === null);
  meter.firstElementChild.style.width = width === null ? '' : `${width}%`;
  eta.textContent = text;
  const quiet = job.activity ? now - job.activity.at : elapsed;
  act.classList.toggle('quiet', quiet > QUIET_MS);
  act.textContent = !job.activity
    ? quiet > QUIET_MS
      ? `${dur(quiet)}째 신호 없음`
      : ''
    : quiet > QUIET_MS
      ? `${job.activity.label} — ${dur(quiet)}째 신호 없음. 길게 생각하는 중일 수 있다 (20분이 넘으면 끊고 다시 시도한다)`
      : `${job.activity.label} · ${quiet < 3000 ? '방금' : `${dur(quiet)} 전`}`;
}

const poll = document.querySelector('[data-poll]');
if (poll) {
  const seed = poll.querySelector('[data-field="job"]');
  let job = seed ? JSON.parse(seed.textContent) : {};
  let skew = job.now ? job.now - Date.now() : 0;
  const draw = () => renderJob(poll, job, skew);
  draw();
  setInterval(draw, 1000);
  const tick = async () => {
    try {
      const j = await fetch(poll.dataset.poll).then((r) => r.json());
      if (!j || j.state !== 'running') return location.reload();
      job = j;
      skew = j.now - Date.now();
      draw();
      poll.querySelector('[data-field="log"]').textContent = j.lines.slice(-25).join('\n');
    } catch {
      /* PC 가 잠깐 안 보이면 다음 차례에 */
    }
    setTimeout(tick, 2500);
  };
  setTimeout(tick, 2500);
}
