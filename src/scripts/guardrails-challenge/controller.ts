// src/scripts/guardrails-challenge/controller.ts
// Framework-free controller for the run-based Guardrails Challenge. Renders the four
// phases (brief -> count -> run -> done) as template strings, patches the live console
// in place so CSS animations survive, and persists board/best/badges to localStorage.
// Control names + severities come from the PUBLIC representative projection only.
import {
  buildRun, c2Points, c2Multiplier, c2Rank, c2EarnedBadges, c2ShareText, mergeBoard,
  SEEDED_BOARD, type Sev, type PlayScenario, type RunScenario, type LogRow, type BoardEntry,
} from './game';

export interface GameData {
  config: { stages: number; baseTimer: number; breachLimit: number; zeroDay: boolean; timerOn: boolean };
  scenarios: PlayScenario[];
  controls: Record<string, { name: string; sev: Sev }>;
  threats: Record<string, { label: string; color: string }>;
  catalogTotal: number;
}

interface Best { score: number; title: string }

const HANDLE_KEY = 'arena.handle';
const BOARD_KEY = 'arena2.board.v1';
const BEST_KEY = 'arena2.best';
const BADGES_KEY = 'arena2.badges';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function readJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) as T : fallback; } catch { return fallback; }
}
function writeJSON(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

interface MonoOpts { size?: number; color?: string; ls?: string; weight?: number; extra?: string }
function mono(text: string, o: MonoOpts = {}): string {
  const { size = 11, color = '#4a4f6e', ls = '0.14em', weight = 600, extra = '' } = o;
  return `<span style="font-family:var(--font-mono);font-size:${size}px;letter-spacing:${ls};color:${color};font-weight:${weight};text-transform:uppercase;${extra}">${text}</span>`;
}

export function initGuardrailsChallenge(root: HTMLElement, data: GameData): () => void {
  const cfg = data.config;
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctrl = (id: string) => data.controls[id] ?? { name: id, sev: 'low' as Sev };
  const threatOf = (t: string) => data.threats[t] ?? { label: t, color: '#8fa2ff' };

  const state = {
    phase: 'brief' as 'brief' | 'count' | 'run' | 'done',
    handle: readJSON<string>(HANDLE_KEY, ''),
    board: readJSON<BoardEntry[]>(BOARD_KEY, SEEDED_BOARD),
    best: readJSON<Best | null>(BEST_KEY, null),
    badges: readJSON<string[]>(BADGES_KEY, []),
    run: [] as RunScenario[],
    qi: 0, score: 0, streak: 0, bestStreak: 0, breaches: 0,
    picked: null as string | null,
    tLeft: 0,
    log: [] as LogRow[],
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  let countTimer: ReturnType<typeof setTimeout> | null = null;
  let raf: number | null = null;
  const clearTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
  const clearCount = () => { if (countTimer) { clearTimeout(countTimer); countTimer = null; } };
  const clearRaf = () => { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };

  // results-only handoff for the share row
  let sharePayload: { score: number; rank: { title: string }; held: number; total: number; contained: boolean; handle: string; log: LogRow[]; run: RunScenario[] } | null = null;
  let cardCanvas: HTMLCanvasElement | null = null;

  // ---------- shared bits ----------
  const threatChip = (t: string): string => {
    const m = threatOf(t);
    return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${m.color}14;color:${m.color};font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:0.06em;white-space:nowrap">${esc(m.label)}</span>`;
  };

  const boardHTML = (highlight?: string): string => `
    <div style="background:#fff;border:1px solid #e5e7f0;border-radius:16px;padding:18px 20px;display:grid;gap:8px;text-align:left">
      ${mono('Leaderboard', { size: 11, color: '#8a8fa8' })}
      ${state.board.map((b, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:6px 10px;border-radius:8px;background:${highlight && b.name === highlight && b.when !== 'seed' ? '#4d66e010' : 'transparent'}">
          ${mono(String(i + 1), { size: 11, color: i < 3 ? 'var(--color-brand)' : '#8a8fa8', extra: 'width:20px' })}
          <span style="flex:1;font-size:13.5px;font-weight:600;color:var(--color-text);font-family:var(--font-mono)">${esc(b.name)}</span>
          <span style="font-size:13.5px;font-weight:700;color:var(--color-text)">${b.score}</span>
        </div>`).join('')}
      <span style="font-size:11px;color:#b7bccf">Scores live in this browser. Beat the house names.</span>
    </div>`;

  const demoCTA = (label: string, sub: string): string => `
    <a href="/contact" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;background:var(--color-brand);color:#fff;text-decoration:none;border-radius:12px;padding:12px 26px;box-shadow:0 10px 24px -10px #4d66e099;font-weight:700;font-size:15px">
      <span>${esc(label)}</span>
      <span style="font-size:11.5px;font-weight:500;opacity:0.85">${esc(sub)}</span>
    </a>`;

  // ---------- brief ----------
  const renderBrief = (): void => {
    const zdRule = cfg.zeroDay && cfg.stages >= 5
      ? `<div style="display:flex;gap:12px;align-items:baseline">${mono('!!', { size: 10, color: '#ff5470' })}<span style="font-size:13.5px;line-height:1.55;color:#4a4f6e">Somewhere in the chain sits a <strong style="color:#c2273f">zero-day gate</strong>: double points, half the time.</span></div>`
      : '';
    const rules: [string, string][] = [
      ['01', 'Each gate is a real technique mid-intrusion. Pick the one guardrail that stops it — keys 1–4.'],
      ['02', 'Speed, severity and streaks multiply points. The timer shrinks as the attacker goes deeper.'],
      ['03', `${cfg.breachLimit} ${cfg.breachLimit === 1 ? 'breach' : 'breaches'} and the attacker is in. The run ends where your wall does.`],
    ];
    root.innerHTML = `
      <div style="display:grid;gap:20px;max-width:620px;margin:0 auto">
        <div style="background:#fff;border:1px solid #e5e7f0;border-radius:18px;padding:26px 28px;display:grid;gap:18px;text-align:center">
          <div style="display:grid;gap:8px">
            ${mono('Mission briefing', { size: 10.5, color: '#ff5470', ls: '0.22em', weight: 700 })}
            <h2 style="margin:0;font-size:27px;font-weight:800;color:var(--color-text);letter-spacing:-0.02em;text-wrap:balance">One intrusion. ${cfg.stages} gates. Hold the wall.</h2>
          </div>
          <div style="display:grid;gap:9px;text-align:left">
            ${rules.map(([n, r]) => `<div style="display:flex;gap:12px;align-items:baseline">${mono(n, { size: 10, color: '#b7bccf' })}<span style="font-size:13.5px;line-height:1.55;color:#4a4f6e">${esc(r)}</span></div>`).join('')}
            ${zdRule}
          </div>
          <div style="display:grid;gap:10px;justify-items:center">
            <input id="c2-handle" value="${esc(state.handle)}" placeholder="Handle for the leaderboard (optional)" maxlength="24"
              style="padding:11px 16px;border-radius:10px;border:1px solid #e5e7f0;font:inherit;font-size:14px;width:300px;text-align:center;outline:none" />
            <button id="c2-start" style="padding:14px 36px;border-radius:12px;border:none;cursor:pointer;font:inherit;background:var(--color-text);color:#fff;font-weight:700;font-size:16px;box-shadow:0 14px 30px -12px #0e1230aa">Enter the war room</button>
            ${mono(state.best ? `Personal best ${state.best.score} · ${state.best.title}` : 'First run — set the bar', { size: 9.5, color: '#b7bccf', ls: '0.1em' })}
          </div>
        </div>
        ${boardHTML()}
      </div>`;
  };

  // ---------- countdown ----------
  const renderCount = (): void => {
    const seq = ['3', '2', '1', 'HOLD THE WALL'];
    const step = (i: number): void => {
      const label = seq[i];
      const big = label.length > 2;
      root.innerHTML = `
        <div style="max-width:720px;margin:0 auto">
          <div class="c2-console c2-count">
            <div style="display:grid;gap:10px;justify-items:center">
              ${mono('Intrusion detected', { size: 11, color: '#ff5470', ls: '0.24em' })}
              <div class="c2-count-num"${big ? ' style="font-size:54px"' : ''}>${label}</div>
              ${mono('Keys 1–4 answer · Enter continues', { size: 10, color: '#ffffff59', ls: '0.14em' })}
            </div>
          </div>
        </div>`;
      if (i >= seq.length - 1) { countTimer = setTimeout(go, 600); }
      else { countTimer = setTimeout(() => step(i + 1), 780); }
    };
    const go = (): void => {
      clearCount();
      state.phase = 'run';
      renderRun();
      startTimer();
    };
    step(0);
  };

  // ---------- run: HUD fragments ----------
  const multChip = (): string => {
    const m = c2Multiplier(state.streak);
    return m > 1 ? `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#f59f3c26;color:#f59f3c;font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:0.06em;white-space:nowrap">×${m} streak</span>` : '';
  };
  const rivalHTML = (): string => {
    const rival = [...state.board].sort((a, b) => a.score - b.score).find(b => b.score > state.score);
    return mono(rival ? `${rival.score - state.score} pts to pass ${esc(rival.name)}` : 'You lead the board', { size: 9, color: '#ffffff59', ls: '0.1em' });
  };
  const wallHTML = (): string => {
    const left = cfg.breachLimit - state.breaches;
    let s = mono('Wall integrity', { size: 9, color: '#ffffff59' });
    for (let i = 0; i < cfg.breachLimit; i++) {
      const intact = i < left;
      s += `<span style="width:20px;height:8px;border-radius:3px;background:${intact ? '#22b07d' : '#ff5470'};opacity:${intact ? 1 : 0.9};transition:background 300ms"></span>`;
    }
    if (state.breaches > 0) s += mono(`${left} left`, { size: 9, color: '#ff8fa3', ls: '0.1em' });
    return s;
  };
  const optsHTML = (q: RunScenario, answered: boolean): string =>
    q.options.map((id, i) => {
      const c = ctrl(id);
      const r = answered ? (id === q.correct ? 'correct' : (state.picked === id ? 'wrong' : 'dim')) : '';
      const mark = r === 'correct' ? '<span style="color:#22b07d;font-weight:800">✓</span>'
        : r === 'wrong' ? '<span style="color:#ff5470;font-weight:800">×</span>' : '';
      return `<button class="c2-opt" data-opt="${esc(id)}" data-r="${r}"${answered ? ' disabled' : ''}>
        <span class="c2-key">${i + 1}</span>
        <span style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:#8fa2ff;flex:none;width:126px">${esc(id)}</span>
        <span style="flex:1;font-size:14px;font-weight:600">${esc(c.name)}</span>
        ${mark}
      </button>`;
    }).join('');
  const trackHTML = (): string =>
    state.run.map((q, i) => {
      const r = state.log[i];
      const s = r ? (r.ok ? 'held' : 'breached') : (i === state.qi ? 'current' : 'pending');
      return `<span class="c2-node" data-node="${i}" data-s="${s}" title="Gate ${i + 1} — ${esc(q.tactic)}"></span>`;
    }).join('');

  const feedbackHTML = (q: RunScenario, pop: { total: number; parts: [string, number | null][] } | null): string => {
    const ok = state.picked === q.correct;
    const gameOver = state.breaches >= cfg.breachLimit;
    const verdict = ok ? 'Deny issued — technique blocked'
      : state.picked === '__timeout' ? 'Too slow — technique executed' : 'Wrong control — technique executed';
    const breakdown = ok && pop
      ? mono(`${pop.parts.map(([l, v]) => v === null ? l : `${l} +${v}`).join(' · ')} = ${pop.total} pts`, { size: 9.5, color: '#ffffff73', ls: '0.08em' })
      : '';
    const label = gameOver ? 'See the damage' : state.qi + 1 >= state.run.length ? 'After-action report' : 'Next gate';
    return `<div style="display:grid;gap:12px;background:${ok ? '#22b07d14' : '#ff547014'};border:1px solid ${ok ? '#22b07d59' : '#ff547059'};border-radius:14px;padding:15px 17px">
      <div style="display:grid;gap:6px">
        ${mono(verdict, { size: 10.5, color: ok ? '#4ed8a4' : '#ff8fa3', ls: '0.16em', weight: 700 })}
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:#d7dbee">${esc(q.explain)}</p>
        ${breakdown}
      </div>
      <button id="c2-next" style="justify-self:start;padding:10px 24px;border-radius:10px;border:none;cursor:pointer;font:inherit;background:${gameOver ? '#ff5470' : '#fff'};color:${gameOver ? '#fff' : 'var(--color-text)'};font-weight:700;font-size:14px">${label}</button>
    </div>`;
  };

  const renderRun = (): void => {
    const q = state.run[state.qi];
    const tColor = threatOf(q.threat).color;
    const timerBlock = cfg.timerOn
      ? `<div class="c2-timerbar" id="c2-timerbar" data-low="false" style="flex:1"><div id="c2-bar" style="width:100%"></div></div>
         <span id="c2-secs" style="font-family:var(--font-mono);font-size:12.5px;font-weight:700;color:#fff;width:26px;text-align:right;font-variant-numeric:tabular-nums">${state.tLeft}</span>`
      : '<div style="flex:1"></div>';
    root.innerHTML = `
      <div style="max-width:720px;margin:0 auto">
        <div class="c2-console" id="c2-console" data-danger="false">
          <div class="c2-track" id="c2-track" aria-label="Kill chain progress">${trackHTML()}</div>

          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:baseline;gap:10px">
              ${mono(`Gate ${state.qi + 1}/${state.run.length}`, { size: 11, color: '#ffffff8c' })}
              ${mono(q.tactic, { size: 10, color: '#8fa2ff', ls: '0.16em' })}
              ${q.zd ? `<span class="c2-zd">${mono('Zero-day · 2×', { size: 9.5, color: '#ff8fa3', ls: '0.14em', weight: 700 })}</span>` : ''}
            </div>
            <div style="flex:1;min-width:140px;display:flex;align-items:center;gap:10px">${timerBlock}</div>
            <div class="c2-hud-score" style="display:grid;gap:3px;justify-items:end">
              <div style="display:flex;align-items:center;gap:9px">
                <span id="c2-mult">${multChip()}</span>
                <span id="c2-score" style="font-family:var(--font-mono);font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff">${state.score}</span>
              </div>
              <span id="c2-rival">${rivalHTML()}</span>
            </div>
          </div>

          <div id="c2-wall" style="display:flex;align-items:center;gap:8px">${wallHTML()}</div>

          <div style="display:grid;gap:9px;padding:4px 2px">
            <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
              ${threatChip(q.threat)}
              ${mono(esc(q.title), { size: 10.5, color: '#ffffff8c' })}
            </div>
            <p style="margin:0;font-size:17px;line-height:1.6;color:#fff;font-weight:500;text-wrap:pretty">${esc(q.scenario)}</p>
            ${mono('Which guardrail stops this?', { size: 10.5, color: tColor })}
          </div>

          <div id="c2-opts" style="display:grid;gap:8px">${optsHTML(q, false)}</div>
          <div id="c2-feedback"></div>
        </div>
      </div>`;
  };

  // ---------- run: timer ----------
  const patchTimer = (): void => {
    const q = state.run[state.qi];
    const bar = root.querySelector<HTMLElement>('#c2-bar');
    const secs = root.querySelector<HTMLElement>('#c2-secs');
    const barWrap = root.querySelector<HTMLElement>('#c2-timerbar');
    const con = root.querySelector<HTMLElement>('#c2-console');
    const low = cfg.timerOn && state.tLeft <= 5 && state.picked === null;
    if (bar) bar.style.width = `${(state.tLeft / q.tMax) * 100}%`;
    if (secs) secs.textContent = String(state.tLeft);
    if (barWrap) barWrap.dataset.low = String(low);
    if (con && state.picked === null) con.dataset.danger = String(low);
  };
  const startTimer = (): void => {
    clearTimer();
    if (!cfg.timerOn) return;
    timer = setInterval(() => {
      state.tLeft -= 1;
      if (state.tLeft <= 0) { state.tLeft = 0; patchTimer(); clearTimer(); resolve('__timeout'); return; }
      patchTimer();
    }, 1000);
  };

  // ---------- run: answer ----------
  const resolve = (id: string): void => {
    if (state.picked !== null) return;
    clearTimer();
    const q = state.run[state.qi];
    const ok = id === q.correct;
    let pop: { total: number; parts: [string, number | null][] } | null = null;
    if (ok) {
      pop = c2Points({ sev: ctrl(q.correct).sev, tMax: q.tMax, tLeft: state.tLeft, timerOn: cfg.timerOn, streak: state.streak, zd: q.zd });
      state.score += pop.total;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
      state.breaches += 1;
    }
    state.picked = id;
    state.log.push({ q, ok, tLeft: state.tLeft, timedOut: id === '__timeout', gained: ok && pop ? pop.total : 0 });

    const gameOver = state.breaches >= cfg.breachLimit;
    const con = root.querySelector<HTMLElement>('#c2-console');
    // options + timer freeze
    const opts = root.querySelector<HTMLElement>('#c2-opts');
    if (opts) opts.innerHTML = optsHTML(q, true);
    const bar = root.querySelector<HTMLElement>('#c2-bar');
    const secs = root.querySelector<HTMLElement>('#c2-secs');
    const barWrap = root.querySelector<HTMLElement>('#c2-timerbar');
    if (bar) bar.style.width = '0%';
    if (secs) secs.textContent = '—';
    if (barWrap) barWrap.dataset.low = 'false';
    // HUD
    const scoreEl = root.querySelector<HTMLElement>('#c2-score');
    const multEl = root.querySelector<HTMLElement>('#c2-mult');
    const rivalEl = root.querySelector<HTMLElement>('#c2-rival');
    if (scoreEl) scoreEl.textContent = String(state.score);
    if (multEl) multEl.innerHTML = multChip();
    if (rivalEl) rivalEl.innerHTML = rivalHTML();
    // wall + track
    const wall = root.querySelector<HTMLElement>('#c2-wall');
    if (wall) wall.innerHTML = wallHTML();
    const node = root.querySelector<HTMLElement>(`[data-node="${state.qi}"]`);
    if (node) node.dataset.s = ok ? 'held' : 'breached';
    // feedback
    const fb = root.querySelector<HTMLElement>('#c2-feedback');
    if (fb) fb.innerHTML = feedbackHTML(q, pop);
    // motion
    if (con) {
      con.dataset.danger = String(gameOver);
      if (ok && !prefersReduced) {
        const el = document.createElement('div');
        el.className = 'c2-pop';
        el.textContent = `+${pop!.total}`;
        con.appendChild(el);
        setTimeout(() => el.remove(), 1000);
      }
      if (!ok && !prefersReduced) {
        con.classList.add('c2-shake');
        setTimeout(() => con.classList.remove('c2-shake'), 380);
      }
    }
  };

  const next = (): void => {
    const gameOver = state.breaches >= cfg.breachLimit;
    if (gameOver || state.qi + 1 >= state.run.length) { finishRun(gameOver); return; }
    state.qi += 1;
    state.picked = null;
    state.tLeft = state.run[state.qi].tMax;
    renderRun();
    startTimer();
  };

  // ---------- finish + results ----------
  const todayISO = (): string => new Date().toISOString().slice(0, 10);

  const finishRun = (gameOver: boolean): void => {
    clearTimer();
    const completed = !gameOver;
    const entry: BoardEntry = { name: state.handle.trim() || 'anonymous', score: state.score, when: todayISO() };
    state.board = mergeBoard(state.board, entry);
    writeJSON(BOARD_KEY, state.board);

    const earned = c2EarnedBadges({ completed, breaches: state.breaches, breachLimit: cfg.breachLimit, bestStreak: state.bestStreak, timerOn: cfg.timerOn, log: state.log });
    const newBadgeIds = earned.map(b => b.id).filter(id => !state.badges.includes(id));
    if (newBadgeIds.length) { state.badges = [...state.badges, ...newBadgeIds]; writeJSON(BADGES_KEY, state.badges); }

    const prevBest = state.best;
    const isNewBest = !prevBest || state.score > prevBest.score;
    if (isNewBest) { state.best = { score: state.score, title: c2Rank(state.score, state.run).title }; writeJSON(BEST_KEY, state.best); }

    state.phase = 'done';
    renderDone({ completed, earned, newBadgeIds, isNewBest, prevBest });
  };

  interface Outcome { completed: boolean; earned: { id: string; label: string }[]; newBadgeIds: string[]; isNewBest: boolean; prevBest: Best | null }

  const renderDone = (o: Outcome): void => {
    const run = state.run, log = state.log;
    const held = log.filter(r => r.ok).length;
    const rank = c2Rank(state.score, run);
    const flawless = o.completed && state.breaches === 0;
    const answered = log.length;
    const acc = answered ? Math.round((held / answered) * 100) : 0;
    const critSaves = log.filter(r => r.ok && ctrl(r.q.correct).sev === 'critical').length;
    const avg = cfg.timerOn && answered ? `${(log.reduce((s, r) => s + (r.q.tMax - r.tLeft), 0) / answered).toFixed(1)}s` : '—';
    const beaten = SEEDED_BOARD.filter(b => state.score > b.score).length;
    const verdict = flawless ? { label: 'Flawless defense', color: '#f59f3c' }
      : o.completed ? { label: 'Breach contained', color: '#22b07d' }
      : { label: `Breached at gate ${log.length}`, color: '#ff5470' };
    const me = state.handle.trim() || 'anonymous';
    const accTone = acc >= 80 ? '#1d6f52' : acc >= 50 ? '#b26a0f' : '#c2273f';

    sharePayload = { score: state.score, rank, held, total: run.length, contained: o.completed, handle: me === 'anonymous' ? '' : me, log, run };

    const stat = (label: string, value: string, tone?: string): string =>
      `<div style="display:grid;gap:3px;justify-items:center;padding:13px 8px;background:#f8f9fe;border-radius:12px">
        <span style="font-family:var(--font-mono);font-size:21px;font-weight:700;color:${tone || 'var(--color-text)'};font-variant-numeric:tabular-nums">${esc(value)}</span>
        ${mono(label, { size: 8.5, color: '#8a8fa8', ls: '0.1em' })}
      </div>`;

    const bestBanner = o.isNewBest
      ? `<span style="justify-self:center;padding:5px 14px;border-radius:999px;background:#f59f3c14;border:1px solid #f59f3c55">${mono(`New personal best${o.prevBest ? ` — was ${o.prevBest.score}` : ''}`, { size: 10, color: '#b26a0f', ls: '0.14em', weight: 700 })}</span>`
      : o.prevBest ? mono(`Personal best ${o.prevBest.score}`, { size: 9.5, color: '#b7bccf', ls: '0.1em' }) : '';

    const recap = run.map((q, i) => {
      const r = log[i];
      const s = r ? (r.ok ? 'held' : 'breached') : 'pending';
      const extra = r ? '' : 'border-color:#dfe3f0;background:#fff';
      const t = `Gate ${i + 1} — ${q.tactic}${r ? (r.ok ? ' · held' : ' · breached') : ' · not reached'}`;
      return `<span class="c2-node" data-s="${s}" title="${esc(t)}" style="${extra}"></span>`;
    }).join('');

    const badgesRow = o.earned.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding-top:2px">
      ${o.earned.map(b => {
        const isNew = o.newBadgeIds.includes(b.id);
        return `<span class="${isNew && !prefersReduced ? 'c2-badge-new' : ''}" style="display:inline-flex;align-items:center;gap:7px;padding:5px 13px;border-radius:999px;background:#f59f3c10;border:1px solid #f59f3c4d">
          <span style="width:6px;height:6px;border-radius:999px;background:#f59f3c"></span>
          ${mono(`${esc(b.label)}${isNew ? ' · new' : ''}`, { size: 9.5, color: '#b26a0f', ls: '0.1em', weight: 700 })}
        </span>`;
      }).join('')}
    </div>` : '';

    const btnStyle = 'padding:10px 18px;border-radius:10px;border:1px solid #e5e7f0;background:#fff;cursor:pointer;font:inherit;font-weight:700;font-size:13.5px;color:var(--color-text)';
    const shareRow = `<div style="display:grid;gap:12px;background:#fff;border:1px solid #e5e7f0;border-radius:16px;padding:18px">
      <div style="display:flex;align-items:baseline;gap:10px;justify-content:space-between;flex-wrap:wrap">
        ${mono('Challenge your peers', { size: 11, color: '#8a8fa8' })}
        ${mono('Paste it in the team channel', { size: 9.5, color: '#b7bccf', ls: '0.08em' })}
      </div>
      <canvas id="c2-card" width="1200" height="630" style="width:100%;height:auto;border-radius:12px;border:1px solid #e5e7f0" aria-label="Shareable result card"></canvas>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="c2-copy" style="${btnStyle}">Copy challenge text</button>
        <button id="c2-download" style="${btnStyle}">Download card (PNG)</button>
      </div>
    </div>`;

    root.innerHTML = `
      <div style="display:grid;gap:18px;max-width:720px;margin:0 auto">
        <div class="${o.isNewBest && !prefersReduced ? 'c2-best' : ''}" style="background:#fff;border:1px solid #e5e7f0;border-radius:18px;padding:28px 30px;display:grid;gap:14px;text-align:center">
          ${mono(verdict.label, { size: 11, color: verdict.color, ls: '0.22em', weight: 700 })}
          <div style="display:grid;gap:2px">
            <div id="c2-scorenum" style="font-size:58px;font-weight:800;color:var(--color-text);letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums">${prefersReduced ? state.score : 0}</div>
            ${mono('points', { size: 9.5, color: '#8a8fa8', ls: '0.14em' })}
          </div>
          <div style="display:grid;gap:4px">
            <div style="font-size:20px;font-weight:800;color:var(--color-brand)">${esc(rank.title)}</div>
            <p style="margin:0;font-size:13.5px;color:#4a4f6e">${esc(rank.note)}</p>
          </div>
          ${bestBanner}
          <div class="c2-track" style="padding:6px 10px 0">${recap}</div>
          ${mono(`${held}/${run.length} gates held · you beat ${beaten} of ${SEEDED_BOARD.length} house defenders`, { size: 9.5, color: '#8a8fa8', ls: '0.1em' })}
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            ${stat('Accuracy', `${acc}%`, accTone)}
            ${stat('Best streak', `×${state.bestStreak}`)}
            ${stat('Critical saves', String(critSaves))}
            ${stat('Avg response', avg)}
          </div>
          ${badgesRow}
        </div>
        ${shareRow}
        ${boardHTML(me)}
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;align-items:center;padding-top:4px">
          <button id="c2-again" style="padding:13px 28px;border-radius:12px;border:none;cursor:pointer;font:inherit;background:var(--color-text);color:#fff;font-weight:700;font-size:15px">Run it again</button>
          ${demoCTA('See these guardrails enforced', 'Book an InstaSecure demo')}
        </div>
      </div>`;

    // score count-up
    const numEl = root.querySelector<HTMLElement>('#c2-scorenum');
    if (numEl && !prefersReduced) {
      const start = performance.now(), dur = 900, target = state.score;
      const tick = (t: number): void => {
        const p = Math.min(1, (t - start) / dur);
        numEl.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // share card
    cardCanvas = root.querySelector<HTMLCanvasElement>('#c2-card');
    if (cardCanvas && sharePayload) {
      drawCard(cardCanvas, sharePayload);
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        document.fonts.ready.then(() => { if (cardCanvas && sharePayload) drawCard(cardCanvas, sharePayload); }).catch(() => {});
      }
    }
  };

  // ---------- share card canvas ----------
  const MONO_FONT = "'BrandMono', ui-monospace, monospace";
  const SANS_FONT = "'BrandSans', system-ui, sans-serif";
  function drawCard(canvas: HTMLCanvasElement, p: NonNullable<typeof sharePayload>): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 1200, H = 630;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0e1230'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4d66e01a';
    for (let x = 40; x < W; x += 48) for (let y = 40; y < H; y += 48) ctx.fillRect(x, y, 2, 2);
    const rr = (x: number, y: number, w: number, h: number, r: number): void => {
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };
    ctx.strokeStyle = '#4d66e0'; ctx.lineWidth = 7;
    rr(64, 62, 52, 40, 17); ctx.stroke();
    ctx.fillStyle = '#4d66e0'; rr(82, 77, 16, 11, 4); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 24px ${MONO_FONT}`;
    ctx.fillText('INSTASECURE · GUARDRAILS CHALLENGE', 140, 90);
    ctx.fillStyle = p.contained ? '#22b07d' : '#ff5470';
    ctx.font = `700 26px ${MONO_FONT}`;
    ctx.fillText(p.contained ? (p.log.every(r => r.ok) ? 'FLAWLESS DEFENSE' : 'BREACH CONTAINED') : `BREACHED AT GATE ${p.log.length}`, 66, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 170px ${SANS_FONT}`;
    ctx.fillText(String(p.score), 60, 360);
    const scoreW = ctx.measureText(String(p.score)).width;
    ctx.font = `500 30px ${MONO_FONT}`; ctx.fillStyle = '#8fa2ff';
    ctx.fillText('PTS', 60 + scoreW + 22, 360);
    ctx.fillStyle = '#ffffff'; ctx.font = `700 44px ${SANS_FONT}`;
    ctx.fillText(p.rank.title, 64, 430);
    ctx.fillStyle = '#9aa0c0'; ctx.font = `400 26px ${SANS_FONT}`;
    ctx.fillText(`${p.held} of ${p.total} gates held across the kill chain`, 64, 470);
    p.run.forEach((_q, i) => {
      const r = p.log[i];
      ctx.fillStyle = r ? (r.ok ? '#22b07d' : '#ff5470') : '#2a3054';
      rr(64 + i * 46, 502, 34, 22, 5); ctx.fill();
    });
    ctx.fillStyle = '#6d7290'; ctx.font = `500 20px ${MONO_FONT}`;
    if (p.handle) ctx.fillText(p.handle.toUpperCase(), 64, 584);
    const url = 'instasecure.ai/learn/guardrails-challenge';
    ctx.fillStyle = '#8fa2ff';
    ctx.fillText(url, W - 64 - ctx.measureText(url).width, 584);
  }

  const copyShare = (): void => {
    if (!sharePayload) return;
    const text = c2ShareText(sharePayload);
    const btn = root.querySelector<HTMLElement>('#c2-copy');
    const done = (): void => { if (btn) { btn.textContent = 'Copied ✓'; setTimeout(() => { if (btn) btn.textContent = 'Copy challenge text'; }, 1600); } };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  };
  const downloadCard = (): void => {
    if (!cardCanvas || !sharePayload) return;
    const a = document.createElement('a');
    a.download = `guardrails-challenge-${sharePayload.score}.png`;
    a.href = cardCanvas.toDataURL('image/png');
    a.click();
  };

  // ---------- run start ----------
  const start = (): void => {
    clearTimer(); clearCount(); clearRaf();
    const seed = Date.now() % 233280;
    state.run = buildRun(data.scenarios, seed, { stages: cfg.stages, baseTimer: cfg.baseTimer, zeroDay: cfg.zeroDay });
    state.qi = 0; state.score = 0; state.streak = 0; state.bestStreak = 0; state.breaches = 0;
    state.picked = null; state.log = [];
    state.tLeft = state.run[0]?.tMax ?? cfg.baseTimer;
    state.phase = 'count';
    renderCount();
  };

  // ---------- events ----------
  const onClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    const opt = t.closest<HTMLElement>('[data-opt]');
    if (opt && state.phase === 'run' && state.picked === null) { resolve(opt.dataset.opt!); return; }
    if (t.closest('#c2-start') && state.phase === 'brief') { start(); return; }
    if (t.closest('#c2-next') && state.phase === 'run') { next(); return; }
    if (t.closest('#c2-again') && state.phase === 'done') { start(); return; }
    if (t.closest('#c2-copy')) { copyShare(); return; }
    if (t.closest('#c2-download')) { downloadCard(); return; }
  };
  const onInput = (e: Event): void => {
    const t = e.target as HTMLElement;
    if (t.id === 'c2-handle') { state.handle = (t as HTMLInputElement).value; writeJSON(HANDLE_KEY, state.handle); }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (state.phase === 'brief') { if (e.key === 'Enter') { e.preventDefault(); start(); } return; }
    if (state.phase !== 'run') return;
    if (e.key === 'Enter' && state.picked !== null) { e.preventDefault(); next(); return; }
    if (state.picked === null && ['1', '2', '3', '4'].includes(e.key)) {
      const id = state.run[state.qi]?.options[Number(e.key) - 1];
      if (id) resolve(id);
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);

  renderBrief();

  return () => {
    clearTimer(); clearCount(); clearRaf();
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    document.removeEventListener('keydown', onKey);
  };
}
