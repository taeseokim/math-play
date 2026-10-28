import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/* ════════════════════════════════════════════
   설정
   ════════════════════════════════════════════ */
const ROUND = 10; // 한 판 문제 수

const GAMES = {
  circle:  { title: '원 그리기', icon: '⭕', desc: '완벽한 원을 그려 봐요', color: 'var(--blue)',
             embed: 'https://bychoi-space.github.io/circle_game/index.html', credit: '노원수학문화관 원 그리기 게임',
             intro: '빨간 점을 가운데에 두고 동그라미를 그려 봐요.' },
  calc:    { title: '셈하기',    icon: '➕', desc: '더하고 빼고 곱해요',     color: 'var(--coral)' },
  compare: { title: '크기 비교', icon: '⚖️', desc: '어느 쪽이 더 클까요?',  color: 'var(--mint)' },
  pattern: { title: '규칙 찾기', icon: '🧩', desc: '다음에 올 것은?',        color: 'var(--purple)' },
  puzzle:  { title: '블록 맞추기', icon: '🔢', desc: '숫자 블록을 순서대로 밀어요', color: '#C9631F',
             embed: lv => `games/puzzle/index.html?level=${{ k: 'easy', low: 'medium', mid: 'hard' }[lv]}`,
             sizes: { k: '3×3', low: '4×4', mid: '5×5' },
             intro: '빈칸 옆 블록을 눌러서 1부터 순서대로 맞춰 봐요.' },
};

const LEVELS = {
  k:   { label: '쉬움',     sub: '유치원',      icon: '🐣' },
  low: { label: '중간',     sub: '초등 1~2', icon: '🐥' },
  mid: { label: '짱어려움', sub: '초등 3~4', icon: '🦅' },
};

const AVATARS = ['🦊', '🐯', '🐰', '🐼', '🐱', '🦄', '🐻', '🐧', '🐨', '🦁', '🐹', '🐙'];

const THINGS = [
  ['🍎', '사과'], ['⭐', '별'], ['🐟', '물고기'], ['🚗', '자동차'], ['🌸', '꽃'],
  ['🐥', '병아리'], ['🎈', '풍선'], ['🍓', '딸기'], ['🐶', '강아지'], ['🍩', '도넛'],
];
const SHAPES = ['🔴', '🔵', '🟡', '🟢', '🟣', '⭐', '❤️', '🔺', '🟧', '🌙'];

const PRAISE = ['정답이에요!', '최고예요!', '잘했어요!', '멋져요!', '대단해요!', '훌륭해요!'];
const RETRY  = ['다시 생각해 볼까요?', '한 번 더 해 봐요!', '천천히 다시 세어 봐요.'];

/* ════════════════════════════════════════════
   상태 (기기에 저장)
   ════════════════════════════════════════════ */
const store = {
  get(k, d) { try { const v = localStorage.getItem('mp_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mp_' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};

const state = {
  nickname: store.get('nickname', ''),
  avatar: AVATARS.includes(store.get('avatar')) ? store.get('avatar') : AVATARS[0],
  level: store.get('level', 'k'),
  sound: store.get('sound', true),
  voice: store.get('voice', true),
  game: null,
  q: null, qIndex: 0, score: 0, tries: 0, marks: [], locked: false,
};

const app = document.getElementById('app');

/* ════════════════════════════════════════════
   Supabase (설정되어 있을 때만)
   ════════════════════════════════════════════ */
let db = null;
const dbReady = (async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  } catch (e) { console.warn('Supabase 연결 실패, 기기 저장으로 진행합니다.', e); }
})();

async function saveScore(rec) {
  await dbReady;
  const local = store.get('scores', []);
  local.push({ ...rec, created_at: new Date().toISOString() });
  store.set('scores', local.slice(-300));
  if (!db) return 'local';
  const { error } = await db.from('scores').insert(rec);
  if (error) { console.warn(error); return 'local'; }
  return 'online';
}

async function loadBoard(game, level) {
  await dbReady;
  if (db) {
    const { data, error } = await db.from('scores')
      .select('nickname, avatar, score, created_at')
      .eq('game', game).eq('level', level)
      .order('score', { ascending: false }).order('created_at', { ascending: true })
      .limit(10);
    if (!error) return { rows: data, online: true };
    console.warn(error);
  }
  const rows = store.get('scores', [])
    .filter(r => r.game === game && r.level === level)
    .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
    .slice(0, 10);
  return { rows, online: false };
}

function bestLocal(game, level) {
  const s = store.get('scores', []).filter(r => r.game === game && r.level === level && r.nickname === state.nickname);
  return s.length ? Math.max(...s.map(r => r.score)) : null;
}

/* ════════════════════════════════════════════
   도우미
   ════════════════════════════════════════════ */
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hasBatchim = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
const iga = w => w + (hasBatchim(w) ? '이' : '가');

function numChoices(ans, { spread = 3, min = 0, extra = [] } = {}) {
  const set = new Set([ans]);
  extra.filter(v => v >= min && v !== ans).forEach(v => set.size < 4 && set.add(v));
  let guard = 0;
  while (set.size < 4 && guard++ < 200) {
    const v = ans + rand(1, spread) * (Math.random() < .5 ? -1 : 1);
    if (v >= min) set.add(v);
  }
  let f = ans + 1;
  while (set.size < 4) set.add(f++);
  return shuffle([...set]).map(v => ({ value: String(v), label: String(v) }));
}

const SYMBOLS = [
  { value: '>', label: '&gt;<small>왼쪽이 커요</small>' },
  { value: '=', label: '=<small>같아요</small>' },
  { value: '<', label: '&lt;<small>오른쪽이 커요</small>' },
];
const cmp = (a, b) => (a > b ? '>' : a < b ? '<' : '=');

function things(emoji, n, { cols = 5, gone = 0 } = {}) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<span class="${i >= n - gone ? 'gone' : ''}" style="animation-delay:${i * 40}ms">${emoji}</span>`;
  }
  return `<div class="things" style="--cols:${Math.min(cols, Math.max(n, 1))}">${html}</div>`;
}

function tenFrames(emoji, n) {
  let html = '', k = 0;
  for (let f = 0; f < Math.ceil(n / 10); f++) {
    html += '<div class="frame">';
    for (let i = 0; i < 10; i++, k++) html += `<b style="animation-delay:${k * 30}ms">${k < n ? emoji : ''}</b>`;
    html += '</div>';
  }
  return `<div class="frames">${html}</div>`;
}

/* ════════════════════════════════════════════
   문제 만들기  — 각 함수는 { prompt, speak, visual, choices, answer } 반환
   i: 몇 번째 문제인지 (0~9) — 뒤로 갈수록 조금씩 어려워짐
   ════════════════════════════════════════════ */
const MAKERS = {
  calc: {
    k(i) {
      const [e, name] = pick(THINGS);
      const max = i < 5 ? 5 : 9;
      if (i < 3 || Math.random() < .65) {
        const a = rand(1, max - 1), b = rand(1, max - a);
        return { prompt: `${a} + ${b} = ?`,
          speak: `${name} ${a}개와 ${b}개를 모으면 모두 몇 개일까요?`,
          visual: `<div class="addrow"><div class="bubble">${things(e, a, { cols: 3 })}</div><span class="op">➕</span><div class="bubble">${things(e, b, { cols: 3 })}</div></div>
                   <div class="expr">${a} + ${b} = <span class="q">?</span></div>`,
          choices: numChoices(a + b, { spread: 2, min: 1 }), answer: String(a + b) };
      }
      const a = rand(2, max), b = rand(1, a - 1);
      return { prompt: `${a} − ${b} = ?`,
        speak: `${name} ${a}개 중에서 ${b}개가 사라졌어요. 몇 개 남았을까요?`,
        visual: `<div class="bubble">${things(e, a, { gone: b })}</div>
                 <div class="expr">${a} − ${b} = <span class="q">?</span></div>`,
        choices: numChoices(a - b, { spread: 2, min: 0 }), answer: String(a - b) };
    },
    low(i) {
      const lim = i < 5 ? 10 : 20;
      if (Math.random() < .55) {
        const a = rand(1, lim - 1), b = rand(1, lim - a);
        return { prompt: '얼마일까요?', speak: `${a} 더하기 ${b}는 얼마일까요?`,
          visual: `<div class="expr">${a} + ${b} = <span class="q">?</span></div>`,
          choices: numChoices(a + b, { spread: 3, min: 0 }), answer: String(a + b) };
      }
      const a = rand(2, lim), b = rand(1, a - 1);
      return { prompt: '얼마일까요?', speak: `${a} 빼기 ${b}는 얼마일까요?`,
        visual: `<div class="expr">${a} − ${b} = <span class="q">?</span></div>`,
        choices: numChoices(a - b, { spread: 3, min: 0 }), answer: String(a - b) };
    },
    mid(i) {
      const r = Math.random();
      if (r < .5) {
        const a = rand(2, 9), b = rand(i < 4 ? 1 : 2, 9), ans = a * b;
        return { prompt: '곱셈구구!', speak: `${a} 곱하기 ${b}는 얼마일까요?`,
          visual: `<div class="expr">${a} × ${b} = <span class="q">?</span></div>`,
          choices: numChoices(ans, { spread: 2, min: 0, extra: [ans + a, ans - a, ans + b] }), answer: String(ans) };
      }
      if (r < .75) {
        const a = rand(11, 79), b = rand(5, 99 - a);
        return { prompt: '얼마일까요?', speak: `${a} 더하기 ${b}는 얼마일까요?`,
          visual: `<div class="expr">${a} + ${b} = <span class="q">?</span></div>`,
          choices: numChoices(a + b, { spread: 2, min: 0, extra: [a + b + 10, a + b - 10] }), answer: String(a + b) };
      }
      const a = rand(30, 99), b = rand(5, a - 10);
      return { prompt: '얼마일까요?', speak: `${a} 빼기 ${b}는 얼마일까요?`,
        visual: `<div class="expr">${a} − ${b} = <span class="q">?</span></div>`,
        choices: numChoices(a - b, { spread: 2, min: 0, extra: [a - b + 10, a - b - 10] }), answer: String(a - b) };
    },
  },

  compare: {
    k(i) {
      const [e, name] = pick(THINGS);
      const a = rand(1, i < 5 ? 6 : 9);
      let b = Math.random() < .2 ? a : rand(1, i < 5 ? 6 : 9);
      return { prompt: '어느 쪽이 더 많을까요?', speak: `어느 쪽 ${name}${hasBatchim(name) ? '이' : '가'} 더 많을까요? 똑같으면 같아요를 눌러요.`,
        visual: `<div class="vs"><div class="side">${things(e, a, { cols: 3 })}</div><div class="mid">vs</div><div class="side">${things(e, b, { cols: 3 })}</div></div>`,
        choices: [
          { value: '>', label: '👈<small>왼쪽</small>' },
          { value: '=', label: '🟰<small>같아요</small>' },
          { value: '<', label: '👉<small>오른쪽</small>' },
        ], answer: cmp(a, b), three: true };
    },
    low(i) {
      const lim = i < 5 ? 20 : 100;
      const a = rand(1, lim);
      const b = Math.random() < .15 ? a : (i >= 5 && Math.random() < .5 ? (a % 10) * 10 + Math.floor(a / 10) || a + 1 : rand(1, lim));
      return { prompt: '알맞은 기호를 골라요', speak: `${a}와 ${b} 중에서 어느 수가 더 클까요? 알맞은 기호를 골라요.`,
        visual: `<div class="expr">${a} <span class="q">?</span> ${b}</div>`,
        choices: SYMBOLS, answer: cmp(a, b), three: true };
    },
    mid() {
      const left = expr();
      const target = Math.max(2, left.v + (Math.random() < .2 ? 0 : pick([-3, -2, -1, 1, 2, 3])));
      const right = expr(target);
      return { prompt: '어느 쪽이 더 클까요?', speak: '두 식을 계산해서 알맞은 기호를 골라요.',
        visual: `<div class="expr" style="font-size:clamp(2rem,9vw,3.4rem)">${left.t} <span class="q">?</span> ${right.t}</div>`,
        choices: SYMBOLS, answer: cmp(left.v, right.v), three: true };
    },
  },

  pattern: {
    k(i) {
      const unit = i < 3 ? 'AB' : pick(['AB', 'ABB', 'AAB', 'ABC']);
      const pool = shuffle(SHAPES);
      const map = { A: pool[0], B: pool[1], C: pool[2] };
      const n = unit.length * 2 + 1;
      const seq = Array.from({ length: n }, (_, k) => map[unit[k % unit.length]]);
      const ans = map[unit[n % unit.length]];
      const opts = shuffle([...new Set([...Object.values(map).slice(0, new Set(unit).size), pool[3]])]).slice(0, 3);
      if (!opts.includes(ans)) opts[0] = ans;
      return { prompt: '다음에 올 것은?', speak: '규칙을 찾아봐요. 물음표 자리에 올 것은 무엇일까요?',
        visual: `<div class="seq">${seq.map((s, k) => `<b style="animation-delay:${k * 60}ms">${s}</b>`).join('')}<b class="hole">?</b></div>`,
        choices: shuffle(opts).map(v => ({ value: v, label: v })), answer: ans, three: true };
    },
    low(i) {
      const down = i >= 4 && Math.random() < .3;
      const step = pick(i < 4 ? [1, 2, 5, 10] : [2, 3, 4, 5, 10]);
      const start = down ? rand(step * 5, step * 5 + 20) : rand(0, 20);
      const seq = Array.from({ length: 5 }, (_, k) => start + (down ? -1 : 1) * step * k);
      return seqQuestion(seq, step, down ? `${step}씩 작아지는 규칙` : null);
    },
    mid() {
      const kind = pick(['add', 'sub', 'mul']);
      let seq, step;
      if (kind === 'add') { step = rand(3, 9); const s = rand(1, 30); seq = Array.from({ length: 5 }, (_, k) => s + step * k); }
      else if (kind === 'sub') { step = rand(3, 9); const s = rand(step * 5, 99); seq = Array.from({ length: 5 }, (_, k) => s - step * k); }
      else { const m = pick([2, 2, 3]); const s = rand(1, m === 2 ? 6 : 3); seq = Array.from({ length: 5 }, (_, k) => s * m ** k); step = m; }
      return seqQuestion(seq, step);
    },
  },
};

function expr(target) {
  // target 이 있으면 그 값이 되는 식을, 없으면 아무 식이나
  if (target === undefined) {
    if (Math.random() < .5) { const a = rand(2, 9), b = rand(2, 9); return { t: `${a}×${b}`, v: a * b }; }
    const a = rand(5, 40), b = rand(5, 40); return { t: `${a}+${b}`, v: a + b };
  }
  const facs = [];
  for (let a = 2; a <= 9; a++) if (target % a === 0 && target / a >= 2 && target / a <= 9) facs.push(a);
  if (facs.length && Math.random() < .6) { const a = pick(facs); return { t: `${a}×${target / a}`, v: target }; }
  if (Math.random() < .5 && target > 3) { const a = rand(1, target - 1); return { t: `${a}+${target - a}`, v: target }; }
  const b = rand(1, 15); return { t: `${target + b}−${b}`, v: target };
}

function seqQuestion(seq, step) {
  const hole = rand(1, seq.length - 1);
  const ans = seq[hole];
  const extra = [ans + step, ans - step, ans + 1, ans - 1];
  return { prompt: '빈칸에 들어갈 수는?', speak: '규칙을 찾아서 물음표 자리에 들어갈 수를 골라요.',
    visual: `<div class="seq">${seq.map((v, k) => k === hole ? '<b class="hole">?</b>' : `<b style="animation-delay:${k * 60}ms">${v}</b>`).join('')}</div>`,
    choices: numChoices(ans, { spread: 2, min: 0, extra }), answer: String(ans) };
}

/* ════════════════════════════════════════════
   소리 · 음성
   ════════════════════════════════════════════ */
let actx = null;
function tone(freqs, dur = .12, type = 'sine') {
  if (!state.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    let t = actx.currentTime;
    for (const f of freqs) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.22, t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + .03);
      t += dur * .85;
    }
  } catch { /* 오디오 미지원 */ }
}
const sfx = {
  tap: () => tone([660], .06, 'triangle'),
  good: () => tone([523, 659, 784], .13),
  bad: () => tone([311, 233], .16, 'triangle'),
  win: () => tone([523, 659, 784, 1047, 784, 1047], .14),
};

let koVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
  koVoice = vs.find(v => /google|yuna|sora|heami|sunhi/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function say(text) {
  if (!state.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = .95; u.pitch = 1.15;
    if (koVoice) u.voice = koVoice;
    speechSynthesis.speak(u);
  } catch { /* 음성 미지원 */ }
}

function confetti(n = 60) {
  const box = document.getElementById('confetti');
  const colors = ['#FF7A59', '#FFC93C', '#2FBF97', '#4D8DF7', '#9B6CF0'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = pick(colors);
    p.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
    p.style.animationDelay = Math.random() * .4 + 's';
    box.appendChild(p);
    setTimeout(() => p.remove(), 2200);
  }
}
function burst(emoji) {
  const b = document.createElement('div');
  b.className = 'burst'; b.textContent = emoji;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 950);
}

/* ════════════════════════════════════════════
   화면: 처음
   ════════════════════════════════════════════ */
function renderHome() {
  stopTalk();
  app.innerHTML = `
  <section class="screen">
    <div class="hero">
      <div class="mascot" aria-hidden="true">${esc(state.avatar)}</div>
      <h1>숫자 놀이터</h1>
      <p>놀면서 수학이랑 친해져요!</p>
      <div class="maker"><span class="maker-k">만든 곳</span><span class="maker-v">🏫 인덕과학기술고등학교</span></div>
    </div>
    <div class="card">
      <div class="field">
        <label for="nick">내 별명</label>
        <input id="nick" class="nick" maxlength="10" autocomplete="off" placeholder="예: 반짝별" value="${esc(state.nickname)}" />
        <small>진짜 이름 대신 별명을 써 주세요. (최대 10글자)</small>
      </div>
      <div class="field">
        <span class="label">내 친구</span>
        <div class="avatars" role="group" aria-label="캐릭터 고르기">
          ${AVATARS.map(a => `<button class="avatar" data-av="${a}" aria-pressed="${a === state.avatar}">${a}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="label">단계</span>
        <div class="levels" role="group" aria-label="단계 고르기">
          ${Object.entries(LEVELS).map(([k, l]) => `
            <button class="level" data-lv="${k}" aria-pressed="${k === state.level}">
              <span class="ic">${l.icon}</span><span>${l.label}</span>
            </button>`).join('')}
        </div>
      </div>
      <button class="big primary" id="go">놀이 시작! ▶</button>
    </div>
    <div class="center"><button class="ghost" id="rank">🏆 순위표 보기</button></div>
  </section>`;

  const nick = app.querySelector('#nick');
  const go = app.querySelector('#go');
  const check = () => { go.disabled = !nick.value.trim(); };
  check();
  nick.addEventListener('input', check);
  nick.addEventListener('keydown', e => { if (e.key === 'Enter' && !go.disabled) go.click(); });

  app.querySelectorAll('.avatar').forEach(b => b.onclick = () => {
    sfx.tap(); state.avatar = b.dataset.av; store.set('avatar', state.avatar);
    app.querySelectorAll('.avatar').forEach(x => x.setAttribute('aria-pressed', x === b));
    app.querySelector('.mascot').textContent = state.avatar;
  });
  app.querySelectorAll('.level').forEach(b => b.onclick = () => {
    sfx.tap(); state.level = b.dataset.lv; store.set('level', state.level);
    app.querySelectorAll('.level').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  go.onclick = () => {
    state.nickname = nick.value.trim().slice(0, 10);
    store.set('nickname', state.nickname);
    sfx.tap(); renderPick();
  };
  app.querySelector('#rank').onclick = () => { sfx.tap(); renderBoard('calc', state.level); };
}

/* ════════════════════════════════════════════
   화면: 놀이 고르기
   ════════════════════════════════════════════ */
function renderPick() {
  stopTalk();
  const lv = LEVELS[state.level];
  app.innerHTML = `
  <section class="screen">
    <div class="who">
      <span class="face">${esc(state.avatar)}</span>
      <span>${esc(state.nickname)} · ${lv.label}</span>
      <button class="ghost" id="change">바꾸기</button>
    </div>
    <h2 class="title">어떤 놀이를 할까요?</h2>
    <div class="games">
      ${Object.entries(GAMES).map(([k, g]) => {
        const best = g.embed ? null : bestLocal(k, state.level);
        return `<button class="game" data-g="${k}" style="--c:${g.color}">
          <span class="ic">${g.icon}</span><span class="nm">${g.title}</span><span class="ds">${g.desc}${g.sizes ? ` · ${g.sizes[state.level]}` : ''}</span>
          ${best !== null ? `<span class="best">내 최고 ⭐ ${best}</span>` : ''}
        </button>`;
      }).join('')}
    </div>
    <div class="center"><button class="ghost" id="rank">🏆 순위표 보기</button></div>
  </section>`;
  app.querySelector('#change').onclick = () => { sfx.tap(); renderHome(); };
  app.querySelector('#rank').onclick = () => { sfx.tap(); renderBoard('calc', state.level); };
  app.querySelectorAll('.game').forEach(b => b.onclick = () => {
    sfx.tap();
    GAMES[b.dataset.g].embed ? renderEmbed(b.dataset.g) : startGame(b.dataset.g);
  });
  say(`${state.nickname}, 어떤 놀이를 할까요?`);
}

/* ════════════════════════════════════════════
   화면: 외부 놀이 (다른 곳에서 만든 게임을 그대로 띄움)
   ════════════════════════════════════════════ */
function renderEmbed(key) {
  stopTalk();
  const g = GAMES[key];
  const url = typeof g.embed === 'function' ? g.embed(state.level) : g.embed;
  app.innerHTML = `
  <section class="screen embed">
    <div class="playbar">
      <button class="close" id="quit" aria-label="놀이 고르기로 돌아가기">✕</button>
      <h2 class="embed-title" style="color:${g.color}">${g.icon} ${g.title}</h2>
      <a class="ghost newtab" href="${url}" target="_blank" rel="noopener">새 창 ↗</a>
    </div>
    <div class="embed-frame">
      <iframe src="${url}" title="${esc(g.title)}" allow="fullscreen" loading="eager"></iframe>
    </div>
    ${g.credit
      ? `<p class="note">출처: <a href="${url}" target="_blank" rel="noopener">${esc(g.credit)}</a> · 화면이 안 보이면 ‘새 창’을 눌러 주세요.</p>`
      : `<p class="note">‘${esc(LEVELS[state.level].label)}’ 단계 · ${g.sizes ? g.sizes[state.level] : ''} 퍼즐이에요. 게임 안에서 난이도를 바꿀 수도 있어요.</p>`}
  </section>`;
  app.querySelector('#quit').onclick = () => { sfx.tap(); renderPick(); };
  if (g.intro) say(g.intro);
}

/* ════════════════════════════════════════════
   화면: 놀이
   ════════════════════════════════════════════ */
let timer = null;
function stopTalk() { clearTimeout(timer); if ('speechSynthesis' in window) speechSynthesis.cancel(); }

function startGame(game) {
  Object.assign(state, { game, qIndex: 0, score: 0, marks: [] });
  nextQuestion();
}

function nextQuestion() {
  stopTalk();
  if (state.qIndex >= ROUND) return renderResult();
  state.q = MAKERS[state.game][state.level](state.qIndex);
  state.tries = 0; state.locked = false;
  renderQuestion();
}

function renderQuestion() {
  const q = state.q;
  const dots = Array.from({ length: ROUND }, (_, k) =>
    `<i class="${k < state.qIndex ? state.marks[k] : k === state.qIndex ? 'now' : ''}"></i>`).join('');
  app.innerHTML = `
  <section class="screen">
    <div class="playbar">
      <button class="close" id="quit" aria-label="그만하기">✕</button>
      <div class="progress" aria-label="${state.qIndex + 1}번째 문제 / ${ROUND}">${dots}</div>
      <div class="score" aria-label="별 ${state.score}개">⭐ ${state.score}</div>
    </div>
    <div class="qcard">
      <div class="prompt"><span>${q.prompt}</span><button class="speak" id="speak" aria-label="다시 듣기">🔊</button></div>
      <div class="visual">${q.visual}</div>
    </div>
    <div class="choices ${q.three ? 'three' : ''}">
      ${q.choices.map(c => `<button class="choice" data-v="${esc(c.value)}">${c.label}</button>`).join('')}
    </div>
    <div class="feedback" id="fb" aria-live="polite"></div>
  </section>`;
  app.querySelector('#quit').onclick = () => { sfx.tap(); renderPick(); };
  app.querySelector('#speak').onclick = () => say(q.speak);
  app.querySelectorAll('.choice').forEach(b => b.onclick = () => answer(b));
  timer = setTimeout(() => say(q.speak), 250);
}

function answer(btn) {
  if (state.locked || btn.classList.contains('wrong')) return;
  const q = state.q, fb = app.querySelector('#fb');
  if (btn.dataset.v === q.answer) {
    state.locked = true;
    btn.classList.add('right');
    const first = state.tries === 0;
    if (first) state.score++;
    state.marks[state.qIndex] = first ? 'ok' : 'miss';
    app.querySelector('.score').textContent = `⭐ ${state.score}`;
    const msg = first ? pick(PRAISE) : '맞았어요! 잘 찾았어요.';
    fb.className = 'feedback good'; fb.textContent = (first ? '🎉 ' : '👍 ') + msg;
    sfx.good(); say(msg);
    if (first) { burst(pick(['⭐', '🌟', '🎉', '💯'])); confetti(24); }
    state.qIndex++;
    timer = setTimeout(nextQuestion, 1400);
  } else {
    state.tries++;
    btn.classList.add('wrong');
    sfx.bad();
    if (state.tries >= 2) {
      // 두 번 틀리면 정답을 살짝 보여 줌
      state.locked = true;
      const right = [...app.querySelectorAll('.choice')].find(b => b.dataset.v === q.answer);
      right.classList.add('hint');
      fb.className = 'feedback bad'; fb.textContent = '정답은 여기 있어요! 눌러 볼까요?';
      say('정답은 반짝이는 칸이에요. 눌러 볼까요?');
      state.locked = false;
      app.querySelectorAll('.choice').forEach(b => { if (b !== right) b.disabled = true; });
    } else {
      const msg = pick(RETRY);
      fb.className = 'feedback bad'; fb.textContent = '🤔 ' + msg;
      say(msg);
    }
  }
}

/* ════════════════════════════════════════════
   화면: 결과
   ════════════════════════════════════════════ */
async function renderResult() {
  stopTalk();
  const s = state.score;
  const medals = s >= 9 ? 3 : s >= 6 ? 2 : s >= 3 ? 1 : 0;
  const msg = ['끝까지 해냈어요! 다시 해 볼까요?', '좋아요! 조금씩 늘고 있어요.', '아주 잘했어요!', '완벽해요! 수학 왕이에요!'][medals];
  app.innerHTML = `
  <section class="screen result">
    <div class="card">
      <h2 class="title" style="margin-bottom:0">${GAMES[state.game].icon} ${GAMES[state.game].title} 끝!</h2>
      <div class="medals" aria-label="메달 ${medals}개">
        ${[0, 1, 2].map(k => `<span class="${k < medals ? '' : 'off'}" style="animation-delay:${k * 200}ms">🌟</span>`).join('')}
      </div>
      <div class="big-score">${ROUND}문제 중 ${s}개!</div>
      <p>${msg}</p>
      <div class="saved" id="saved">점수를 저장하고 있어요…</div>
      <div class="actions">
        <button class="big primary" id="again">한 번 더! 🔁</button>
        <button class="big" id="other">다른 놀이 🎲</button>
        <button class="ghost" id="rank" style="justify-self:center">🏆 순위표 보기</button>
      </div>
    </div>
  </section>`;
  app.querySelector('#again').onclick = () => { sfx.tap(); startGame(state.game); };
  app.querySelector('#other').onclick = () => { sfx.tap(); renderPick(); };
  app.querySelector('#rank').onclick = () => { sfx.tap(); renderBoard(state.game, state.level); };
  sfx.win(); if (medals >= 2) confetti(90);
  say(`${ROUND}문제 중에 ${s}개를 맞혔어요. ${msg}`);

  const where = await saveScore({ nickname: state.nickname, avatar: state.avatar, game: state.game, level: state.level, score: s, total: ROUND });
  const el = document.getElementById('saved');
  if (el) el.textContent = where === 'online' ? '✅ 점수를 순위표에 올렸어요.' : '💾 점수를 이 기기에 저장했어요.';
}

/* ════════════════════════════════════════════
   화면: 순위표
   ════════════════════════════════════════════ */
async function renderBoard(game, level) {
  stopTalk();
  app.innerHTML = `
  <section class="screen">
    <h2 class="title">🏆 순위표</h2>
    <div class="tabs" role="group" aria-label="놀이">
      ${Object.entries(GAMES).filter(([, g]) => !g.embed).map(([k, g]) => `<button class="tab" data-g="${k}" aria-pressed="${k === game}">${g.icon} ${g.title}</button>`).join('')}
    </div>
    <div class="tabs" role="group" aria-label="단계">
      ${Object.entries(LEVELS).map(([k, l]) => `<button class="tab lv" data-l="${k}" aria-pressed="${k === level}">${l.icon} ${l.label}</button>`).join('')}
    </div>
    <ol class="board" id="board"><li class="empty" style="box-shadow:none;background:none;justify-content:center">불러오는 중…</li></ol>
    <p class="note" id="note"></p>
    <div class="center"><button class="ghost" id="back">← 돌아가기</button></div>
  </section>`;
  app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { sfx.tap(); renderBoard(b.dataset.g, level); });
  app.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { sfx.tap(); renderBoard(game, b.dataset.l); });
  app.querySelector('#back').onclick = () => { sfx.tap(); state.nickname ? renderPick() : renderHome(); };

  const { rows, online } = await loadBoard(game, level);
  const board = document.getElementById('board');
  if (!board) return;
  const medal = ['🥇', '🥈', '🥉'];
  board.innerHTML = rows.length
    ? rows.map((r, k) => `<li class="${r.nickname === state.nickname ? 'me' : ''}">
        <span class="rk">${medal[k] || k + 1}</span>
        <span style="font-size:1.8rem">${esc(r.avatar || '🙂')}</span>
        <span class="nm">${esc(r.nickname)}</span>
        <span class="pt">⭐ ${r.score}</span></li>`).join('')
    : '<li class="empty" style="box-shadow:none;background:none;justify-content:center">아직 기록이 없어요. 첫 번째 주인공이 되어 볼까요?</li>';
  document.getElementById('note').textContent = online ? '모든 친구들의 기록이에요.' : '이 기기에서 놀이한 기록이에요.';
}

/* ════════════════════════════════════════════
   상단 버튼 · 시작
   ════════════════════════════════════════════ */
const soundBtn = document.getElementById('soundBtn');
const voiceBtn = document.getElementById('voiceBtn');
const syncToggles = () => {
  soundBtn.setAttribute('aria-pressed', state.sound);
  voiceBtn.setAttribute('aria-pressed', state.voice);
};
soundBtn.onclick = () => { state.sound = !state.sound; store.set('sound', state.sound); syncToggles(); sfx.tap(); };
voiceBtn.onclick = () => {
  state.voice = !state.voice; store.set('voice', state.voice); syncToggles();
  if (!state.voice) stopTalk(); else say('문제를 읽어 줄게요.');
};
document.getElementById('homeBtn').onclick = () => { sfx.tap(); renderHome(); };
syncToggles();

state.nickname ? renderPick() : renderHome();

// 테스트용으로 문제 생성기를 노출 (화면에는 영향 없음)
window.__mathPlay = { MAKERS, GAMES, LEVELS };
