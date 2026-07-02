// src/scripts/guardrails-challenge/controller.ts
import {
  SEEDED_BOARD, scoreRound, rankOf, buildRounds, mergeBoard,
  type BoardEntry, type PlayScenario,
} from './game';

export interface GameData {
  rounds: number;
  timerOn: boolean;
  threats: Record<string, { label: string; color: string }>;
  scenarios: PlayScenario[];
}

const HANDLE_KEY = 'arena.handle';
const BOARD_KEY = 'arena.board.v1';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function readJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) as T : fallback; } catch { return fallback; }
}
function writeJSON(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export function initGuardrailsChallenge(root: HTMLElement, data: GameData): () => void {
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    phase: 'intro' as 'intro' | 'play' | 'done',
    handle: readJSON<string>(HANDLE_KEY, ''),
    board: readJSON<BoardEntry[]>(BOARD_KEY, SEEDED_BOARD),
    qs: [] as PlayScenario[],
    qi: 0,
    score: 0,
    streak: 0,
    picked: null as string | null,
    tLeft: 20,
  };
  let timer: ReturnType<typeof setInterval> | null = null;
  const clear = () => { if (timer) { clearInterval(timer); timer = null; } };

  // ---------- helpers ----------
  const MONO = "font-mono uppercase";
  const boardHTML = (highlight?: string) => `
    <div class="bg-white border border-black/5 rounded-2xl px-5 py-4 grid gap-2 text-left">
      <span class="${MONO} tracking-[0.14em] text-[11px] text-slate-400">Leaderboard</span>
      ${state.board.map((b, i) => `
        <div class="flex items-center gap-3 px-2.5 py-1.5 rounded-lg ${highlight && b.name === highlight && b.when !== 'seed' ? 'bg-[#4d66e010]' : ''}">
          <span class="${MONO} text-[11px] w-5 ${i < 3 ? 'text-[var(--color-brand)]' : 'text-slate-400'}">${i + 1}</span>
          <span class="flex-1 font-mono text-[13.5px] font-semibold text-[var(--color-text)]">${esc(b.name)}</span>
          <span class="text-[13.5px] font-bold text-[var(--color-text)]">${b.score}</span>
        </div>`).join('')}
      <span class="text-[11px] text-slate-400">Scores are stored in this browser. Beat the house names.</span>
    </div>`;

  const renderIntro = () => {
    root.innerHTML = `
      <div class="grid gap-6 max-w-[620px] mx-auto text-center py-6">
        <div class="grid gap-2.5">
          <span class="${MONO} tracking-[0.18em] text-[11px] text-[var(--color-brand)]">The Guardrails Challenge</span>
          <h2 class="text-[30px] font-bold text-[var(--color-text)] tracking-[-0.02em] text-balance">Real attack. Four guardrails. One stops it.</h2>
          <p class="mx-auto text-[15px] leading-relaxed text-slate-600 max-w-[480px]">${data.rounds} scenarios drawn from real cloud breaches. Pick the preventive control that stops each one cold. Speed and streaks earn bonus points.</p>
        </div>
        <div class="grid gap-2.5 justify-items-center">
          <input id="gc-handle" value="${esc(state.handle)}" placeholder="Handle for the leaderboard (optional)" maxlength="24"
            class="px-4 py-2.5 rounded-lg border border-black/10 text-[14px] w-[300px] text-center outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition" />
          <button id="gc-start" class="px-8 py-3 rounded-full bg-[var(--color-brand)] text-white font-bold text-[16px] shadow-md shadow-[var(--color-brand)]/25 hover:opacity-90 transition">Start the challenge</button>
        </div>
        ${boardHTML()}
      </div>`;
    const handleEl = root.querySelector<HTMLInputElement>('#gc-handle');
    handleEl?.addEventListener('input', () => { state.handle = handleEl.value; writeJSON(HANDLE_KEY, state.handle); });
    root.querySelector('#gc-start')?.addEventListener('click', start);
  };

  const renderPlay = () => {
    const q = state.qs[state.qi];
    const answered = state.picked !== null;
    const threat = data.threats[q.threat];
    const progress = ((state.qi + (answered ? 1 : 0)) / state.qs.length) * 100;
    root.innerHTML = `
      <div class="grid gap-4 max-w-[720px] mx-auto">
        <div class="flex items-center gap-3.5 flex-wrap">
          <span class="${MONO} tracking-[0.14em] text-[11px] text-slate-400">Round ${state.qi + 1}/${state.qs.length}</span>
          <div class="flex-1 h-1.5 rounded-full bg-[#eef1fb] overflow-hidden min-w-[120px]">
            <div class="h-full rounded-full bg-[var(--color-brand)] ${prefersReduced ? '' : 'transition-[width] duration-300'}" style="width:${progress}%"></div>
          </div>
          ${state.streak > 1 ? `<span class="font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full" style="color:#f59f3c;background:#f59f3c14">streak ×${state.streak}</span>` : ''}
          <span class="${MONO} tracking-[0.14em] text-[12px] text-[var(--color-text)]">${state.score} pts</span>
          ${data.timerOn ? ringHTML(state.tLeft) : ''}
        </div>

        <div class="bg-white border border-black/5 rounded-2xl px-6 py-5 grid gap-2.5">
          <div class="flex gap-2 items-center flex-wrap">
            <span class="font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full" style="color:${threat.color};background:${threat.color}14">${esc(threat.label)}</span>
            <span class="${MONO} tracking-[0.14em] text-[10.5px] text-slate-400">${esc(q.title)}</span>
          </div>
          <p class="text-[16.5px] leading-relaxed text-[var(--color-text)] font-medium">${esc(q.scenario)}</p>
          <span class="${MONO} tracking-[0.14em] text-[10.5px]" style="color:${threat.color}">Which guardrail stops this?</span>
        </div>

        <div class="grid gap-2">
          ${q.options.map(o => {
            const isCorrect = o.id === q.correct;
            const isPicked = state.picked === o.id;
            let cls = 'border-black/10 bg-white';
            let mark = '';
            if (answered && isCorrect) { cls = 'border-[#22b07d] bg-[#22b07d0d]'; mark = '<span class="text-[#22b07d] font-extrabold">✓</span>'; }
            else if (answered && isPicked) { cls = 'border-[#ff5470] bg-[#ff54700d]'; mark = '<span class="text-[#ff5470] font-extrabold">×</span>'; }
            return `<button data-pick="${esc(o.id)}" ${answered ? 'disabled' : ''}
              class="flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px] ${cls} text-left ${answered ? 'cursor-default' : 'cursor-pointer hover:border-[var(--color-brand)]/50'} transition-colors">
              <span class="font-mono text-[10.5px] font-bold text-slate-400 flex-none w-[130px]">${esc(o.id)}</span>
              <span class="flex-1 text-[14px] font-semibold text-[var(--color-text)]">${esc(o.name)}</span>
              ${mark}
            </button>`;
          }).join('')}
        </div>

        ${answered ? `
          <div class="grid gap-3 rounded-2xl px-[18px] py-4 border" style="background:${state.picked === q.correct ? '#22b07d0d' : '#ff54700d'};border-color:${state.picked === q.correct ? '#22b07d44' : '#ff547044'}">
            <p class="text-[14px] leading-relaxed text-[var(--color-text)]"><strong>${state.picked === q.correct ? 'Blocked. ' : state.picked === '__timeout' ? 'Time. ' : 'Not quite. '}</strong>${esc(q.explain)}</p>
            <button id="gc-next" class="justify-self-start px-6 py-2.5 rounded-full bg-[var(--color-text)] text-white font-bold text-[14px] hover:opacity-90 transition">${state.qi + 1 >= state.qs.length ? 'See results' : 'Next round'}</button>
          </div>` : ''}
      </div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(btn =>
      btn.addEventListener('click', () => pick(btn.dataset.pick!)));
    root.querySelector('#gc-next')?.addEventListener('click', next);
  };

  const renderDone = () => {
    const rank = rankOf(state.score, state.qs.length);
    const me = state.handle.trim() || 'anonymous';
    root.innerHTML = `
      <div class="grid gap-5 max-w-[620px] mx-auto text-center py-6">
        <div class="bg-white border border-black/5 rounded-2xl p-8 grid gap-2">
          <span class="${MONO} tracking-[0.14em] text-[11px] text-slate-400">Final score</span>
          <div class="text-[52px] font-extrabold text-[var(--color-text)] tracking-[-0.03em] leading-none">${state.score}</div>
          <div class="text-[19px] font-bold text-[var(--color-brand)]">${esc(rank.title)}</div>
          <p class="text-[14px] text-slate-600">${esc(rank.note)}</p>
        </div>
        ${boardHTML(me)}
        <div class="flex gap-3 justify-center flex-wrap items-center">
          <button id="gc-again" class="px-6 py-3 rounded-full border border-black/10 bg-white font-bold text-[14px] text-[var(--color-text)] hover:bg-slate-50 transition">Play again</button>
          <a href="/contact" class="inline-flex flex-col items-center gap-0.5 bg-[var(--color-brand)] text-white no-underline rounded-full px-7 py-3 shadow-md shadow-[var(--color-brand)]/25 font-bold text-[15px] hover:opacity-90 transition">
            <span>See these guardrails enforced</span>
            <span class="text-[11.5px] font-medium opacity-85">Book an InstaSecure demo</span>
          </a>
        </div>
      </div>`;
    root.querySelector('#gc-again')?.addEventListener('click', start);
  };

  const ringHTML = (t: number) => {
    const size = 38, stroke = 4, r = (size - stroke) / 2, C = 2 * Math.PI * r;
    const pct = t / 20, color = t <= 5 ? '#ff5470' : '#4d66e0';
    return `
      <div class="relative flex-none" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" style="aspect-ratio:1/1">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e5e7f0" stroke-width="${stroke}"></circle>
          <circle class="gc-ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
            stroke-dasharray="${C * pct} ${C}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
        </svg>
        <div class="absolute inset-0 grid place-items-center">
          <span class="gc-ring-num font-mono text-[11.5px] font-bold" style="color:${color}">${t}</span>
        </div>
      </div>`;
  };

  const updateRing = () => {
    const size = 38, stroke = 4, r = (size - stroke) / 2, C = 2 * Math.PI * r;
    const t = state.tLeft, color = t <= 5 ? '#ff5470' : '#4d66e0';
    const fill = root.querySelector<SVGCircleElement>('.gc-ring-fill');
    const num = root.querySelector<HTMLElement>('.gc-ring-num');
    if (fill) { fill.setAttribute('stroke-dasharray', `${C * (t / 20)} ${C}`); fill.setAttribute('stroke', color); }
    if (num) { num.textContent = String(t); num.style.color = color; }
  };

  // ---------- actions ----------
  const startTimer = () => {
    clear();
    if (!data.timerOn) return;
    timer = setInterval(() => {
      state.tLeft -= 1;
      if (state.tLeft <= 0) { state.tLeft = 0; updateRing(); clear(); pick('__timeout'); return; }
      updateRing();
    }, 1000);
  };

  const start = () => {
    const seed = Date.now() % 233280;
    state.qs = buildRounds(data.scenarios, seed, data.rounds);
    state.qi = 0; state.score = 0; state.streak = 0; state.picked = null; state.tLeft = 20; state.phase = 'play';
    renderPlay(); startTimer();
  };

  const pick = (id: string) => {
    if (state.picked !== null) return;
    clear();
    const q = state.qs[state.qi];
    const correct = id === q.correct;
    state.score += scoreRound({ correct, timeLeft: state.tLeft, timerOn: data.timerOn, streak: state.streak });
    state.streak = correct ? state.streak + 1 : 0;
    state.picked = id;
    renderPlay();
  };

  const next = () => {
    if (state.qi + 1 >= state.qs.length) {
      const entry: BoardEntry = { name: state.handle.trim() || 'anonymous', score: state.score, when: new Date().toISOString().slice(0, 10) };
      state.board = mergeBoard(state.board, entry);
      writeJSON(BOARD_KEY, state.board);
      state.phase = 'done';
      renderDone();
    } else {
      state.qi += 1; state.picked = null; state.tLeft = 20;
      renderPlay(); startTimer();
    }
  };

  renderIntro();
  return () => clear();
}
