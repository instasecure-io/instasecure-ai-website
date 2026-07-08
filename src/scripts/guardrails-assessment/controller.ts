import {
  coverage, openThreatWeights, topMissing,
  mandatoryGaps, frameworkGaps, verdictTier, daysUntilMonth, auditTamperGaps,
  orgScopeGapCount,
  lifecycleView, playbookView, attackCompleteness, sharedOpenGaps,
  type AssessControl, type PhaseRef, type ScenarioLite, type FrameworkRef, type PlaybookNode,
} from './assess';
import type { ActorMeta, PlaybookStep, LifecycleTactic } from '@/data/guardrails/attack-chains';

export interface AssessData {
  controls: AssessControl[];
  groups: Record<string, { label: string; short: string; phase: number; blurb: string }>;
  phases: PhaseRef[];
  threats: Record<string, { label: string; color: string }>;
  scenarios: ScenarioLite[];
  frameworks: FrameworkRef[];
  aiControlIds: string[];
  auditTamperIds: string[];
  formspreeEndpoint: string | null;
  // attack sections (§2 lifecycle + §3 playbooks)
  actors: Record<string, ActorMeta>;
  chains: { id: string; steps: PlaybookStep[] }[];
  lifecycle: LifecycleTactic[];
  storyMap: Record<string, { title: string; explain: string }>;
}

const HAVE_KEY = 'arena.assess.v1';
const AUDIT_KEY = 'arena.assess.audit';
const EMAIL_KEY = 'arena.assess.email';

const SEV_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ff5470' },
  high: { label: 'High', color: '#f59f3c' },
  medium: { label: 'Medium', color: '#4d66e0' },
  low: { label: 'Low', color: '#8a8fa8' },
};
const IMPL_META: Record<string, string> = { scp: 'SCP', rcp: 'RCP', vpc_endpoint_policy: 'VPC-EP' };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Report palette — the redesigned Gap Report is a self-contained "document" with its own
// darker ink (#0e1230), distinct from the site --color-text. Content-signaling colors are
// literal hex; TEXT on tinted/white bg uses the darkened two-tone pair (grTextTone in the ref).
const GR = {
  ink: '#0e1230', body: '#4a4f6e', muted: '#8a8fa8', faint: '#b7bccf',
  border: '#e5e7f0', track: '#eef1fb', rowBg: '#f8f9fe',
  brand: '#4d66e0', green: '#22b07d', red: '#ff5470', amber: '#f59f3c', purple: '#b95ad8',
  slate: '#64748b', slateDark: '#475569',
};
const TEXT_TONE: Record<string, string> = {
  '#ff5470': '#c2273f', '#f59f3c': '#b26a0f', '#22b07d': '#1d6f52', '#b95ad8': '#9a48b5', '#7a7fe0': '#5b60c9',
};
const tone = (c: string): string => TEXT_TONE[c] ?? c;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function readJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) as T : fallback; } catch { return fallback; }
}
function writeJSON(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}
function fmtMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${MONTH_NAMES[idx]} ${m[1]}` : ym;
}
function covColor(pct: number): string {
  return pct > 0.75 ? '#22b07d' : pct > 0.4 ? '#4d66e0' : '#f59f3c';
}
function ringSVG(pct: number, size: number, stroke: number, color: string, fillId: string, inner: string): string {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return `
    <div class="relative flex-none" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" style="aspect-ratio:1/1">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e5e7f0" stroke-width="${stroke}"></circle>
        <circle ${fillId ? `id="${fillId}"` : ''} cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${C * Math.min(1, Math.max(0, pct))} ${C}" stroke-linecap="round"
          transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
      </svg>
      <div class="absolute inset-0 grid place-items-center">${inner}</div>
    </div>`;
}

// ---------- report atoms (ported from report-shared.jsx) ----------
interface MonoOpts { size?: number; color?: string; ls?: string; weight?: number; extra?: string }
function grMono(text: string, opts: MonoOpts = {}): string {
  const { size = 11, color = GR.muted, ls = '0.14em', weight = 500, extra = '' } = opts;
  return `<span style="font-family:var(--font-mono);font-size:${size}px;color:${color};letter-spacing:${ls};text-transform:uppercase;font-weight:${weight};${extra}">${text}</span>`;
}
function grSection(index: string, title: string, right: string, inner: string, extraClass = ''): string {
  return `<section class="gr-section ${extraClass}" style="display:grid;gap:18px">
    <div style="display:flex;align-items:baseline;gap:14px;border-top:1px solid ${GR.border};padding-top:22px;flex-wrap:wrap">
      ${grMono(index, { size: 11, color: GR.faint, ls: '0.18em', weight: 600 })}
      <h2 style="margin:0;font-family:var(--font-serif);font-size:22px;font-weight:600;letter-spacing:-0.012em;color:${GR.ink};flex:1;min-width:200px">${title}</h2>
      ${right}
    </div>
    ${inner}
  </section>`;
}
function grAllClear(inner: string): string {
  return `<div style="display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-radius:12px;background:${GR.green}0d;border:1px solid ${GR.green}14">
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style="flex-shrink:0;margin-top:1px"><circle cx="9" cy="9" r="9" fill="${GR.green}"></circle><path d="M5 9.2 L7.8 12 L13 6.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    <p style="margin:0;font-size:15px;line-height:1.55;color:${GR.ink};font-weight:500;text-wrap:pretty">${inner}</p>
  </div>`;
}
function lockMark(size = 24, color = GR.brand): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true" style="aspect-ratio:1/1"><rect x="3" y="5" width="20" height="16" rx="7" fill="none" stroke="${color}" stroke-width="3"></rect><rect x="10" y="11" width="6" height="4" rx="1.5" fill="${color}"></rect></svg>`;
}
function grSevBadge(sev: string): string {
  const m = SEV_META[sev] ?? SEV_META.low;
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:${m.color}14;flex-shrink:0"><span style="width:6px;height:6px;border-radius:999px;background:${m.color}"></span>${grMono(m.label, { size: 10, color: tone(m.color), ls: '0.1em', weight: 600 })}</span>`;
}
function grImplPill(impl: string): string {
  return `<span style="padding:3px 9px;border-radius:999px;border:1px solid ${GR.border};background:${GR.rowBg};flex-shrink:0">${grMono(IMPL_META[impl] ?? impl, { size: 10, color: GR.body, ls: '0.08em', weight: 600 })}</span>`;
}

// ---------- attack-section atoms (ported from report-sec3-playbooks.jsx) ----------
const mitreUrl = (t: string): string => `https://attack.mitre.org/techniques/${t.replace('.', '/')}/`;
function stateIcon(st: string, size = 16): string {
  if (st === 'no-control') return `<span style="width:${size}px;height:${size}px;border-radius:999px;background:#fff;border:1.5px dashed ${GR.slate}99;display:grid;place-content:center;flex-shrink:0;box-sizing:border-box" aria-label="No preventive control — scan/detect territory"><svg width="${size * 0.52}" height="${size * 0.52}" viewBox="0 0 12 12"><path d="M6 2.4 L10.1 9.7 H1.9 Z" fill="none" stroke="${GR.slate}" stroke-width="1.5" stroke-linejoin="round"></path></svg></span>`;
  if (st === 'open') return `<span style="width:${size}px;height:${size}px;border-radius:999px;background:#fff;border:2px solid ${GR.red};display:grid;place-content:center;flex-shrink:0;box-sizing:border-box" aria-label="Open — not attested"><svg width="${size * 0.44}" height="${size * 0.44}" viewBox="0 0 11 11"><path d="M2 2 L9 9 M9 2 L2 9" stroke="${GR.red}" stroke-width="2.4" stroke-linecap="round"></path></svg></span>`;
  return `<span style="width:${size}px;height:${size}px;border-radius:999px;background:${GR.green};display:grid;place-content:center;flex-shrink:0;box-sizing:border-box" aria-label="Closed — attested"><svg width="${size * 0.56}" height="${size * 0.56}" viewBox="0 0 14 14"><path d="M3 7.4 L5.8 10 L11 4.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`;
}
function stateLegend(): string {
  return `<div class="gr-legend">
    <span class="gr-leg-item">${stateIcon('closed', 14)} Enforced (attested)</span>
    <span class="gr-leg-item">${stateIcon('open', 14)} Open (not attested)</span>
    <span class="gr-leg-item">${stateIcon('no-control', 14)} No preventive control — scan / detect territory</span>
  </div>`;
}
function storyCaret(open: boolean): string {
  return `<svg class="gr-story-caret" width="8" height="8" viewBox="0 0 8 8" style="transform:${open ? 'rotate(90deg)' : 'none'}" aria-hidden="true"><path d="M2.5 1 L6 4 L2.5 7" stroke="#8a8fa8" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}
function storyBlock(sc: { title: string; explain: string }): string {
  return `<div class="gr-vstory"><span class="gr-vstory-title">“${esc(sc.title)}”</span><span class="gr-vstory-text">${esc(sc.explain)}</span></div>`;
}
function infoPop(actor: ActorMeta): string {
  const aliasRow = actor.aliases
    ? `<span class="gr-pop-row"><span class="gr-pop-label">Aliases</span><span class="gr-pop-val">${esc(actor.aliases)}</span></span>`
    : '';
  const mitreVal = actor.mitreGroup
    ? `<a href="${esc(actor.mitreUrl ?? '')}" target="_blank" rel="noreferrer">${esc(actor.mitreGroup)} — attack.mitre.org</a>`
    : 'No MITRE group designation';
  const sources = actor.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.name)} · ${esc(s.date)}</a>`).join('');
  return `<span class="gr-info-pop" role="dialog" aria-label="${esc(actor.name)} provenance">
    ${aliasRow}
    <span class="gr-pop-row"><span class="gr-pop-label">MITRE group</span><span class="gr-pop-val">${mitreVal}</span></span>
    <span class="gr-pop-row"><span class="gr-pop-label">Sources</span><span class="gr-pop-val" style="display:grid;gap:2px">${sources}</span></span>
  </span>`;
}

const MONO = 'font-mono uppercase';

const VERDICT_COPY: Record<string, string> = {
  open: "The perimeter is mostly open — attackers have room to operate. The gaps below aren't theoretical: they map to the same techniques behind real cloud breaches.",
  foundation: 'Solid foundation — but the gaps below are exactly where breaches happen. Most orgs stall here, and the advanced patterns are the ones that hurt.',
  strong: "Strong posture. Close the last gaps and the wall is complete — then verify it's actually enforced everywhere you think it is.",
};

export function initGuardrailsAssessment(root: HTMLElement, data: AssessData): () => void {
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const barTransition = prefersReduced ? '' : 'transition-[width] duration-500 ease-out';
  const controlsById = new Map(data.controls.map(c => [c.id, c]));
  const mandatoryTotal = data.controls.filter(c => c.tier === 'mandatory').length;

  const state = {
    have: new Set<string>(readJSON<string[]>(HAVE_KEY, [])),
    openGroup: null as string | null,
    view: 'assess' as 'assess' | 'report',
    audit: readJSON<string>(AUDIT_KEY, ''),
    email: readJSON<string>(EMAIL_KEY, ''),
    gateOpen: false,
    gateBusy: false,
    gateError: false,
    emailDraft: '',
    // §2/§3 interaction state
    selectedStage: null as string | null,
    expandedStories: new Set<string>(),
    collapsedActors: new Set<string>(
      (data.chains ?? []).filter(ch => !data.actors?.[ch.id]?.flagship).map(ch => ch.id),
    ),
    openPopover: null as string | null,
  };
  const persistHave = () => writeJSON(HAVE_KEY, [...state.have]);
  const groupControls = (key: string) => data.controls.filter(c => c.group === key);

  // ---------- assess view (rendered ONCE; targeted updates after) ----------
  const scoreboardHTML = () => {
    const cov = coverage(state.have, data.controls, data.phases);
    return `
      <div class="bg-white border border-black/5 rounded-2xl p-5 flex gap-5 items-center flex-wrap">
        ${ringSVG(cov.pct, 92, 9, covColor(cov.pct), 'ga-cov-fill', `
          <div class="text-center">
            <div class="text-[22px] font-extrabold text-[var(--color-text)] leading-none"><span id="ga-cov-pct">${Math.round(cov.pct * 100)}</span><span class="text-[12px] font-semibold">%</span></div>
            <span class="${MONO} tracking-[0.1em] text-[8.5px] text-slate-400">coverage</span>
          </div>`)}
        <div class="flex-1 min-w-[260px] grid gap-2">
          ${cov.perPhase.map(p => `
            <div class="flex items-center gap-2.5">
              <span class="${MONO} text-[10px] w-5 flex-none" style="color:${p.color}">0${p.n}</span>
              <span class="text-[12.5px] font-semibold text-slate-600 w-[190px] flex-none">${esc(p.name)}</span>
              <div class="flex-1 h-[7px] rounded-full bg-[#eef1fb] overflow-hidden">
                <div data-phase-fill="${p.n}" class="h-full rounded-full ${barTransition}" style="width:${p.pct * 100}%;background:${p.color}"></div>
              </div>
              <span data-phase-pct="${p.n}" class="${MONO} text-[10px] text-slate-400 w-[34px] text-right flex-none">${Math.round(p.pct * 100)}%</span>
            </div>`).join('')}
        </div>
        <div class="grid gap-2 justify-items-center">
          <button id="ga-open-report" class="px-5 py-2.5 rounded-full bg-[var(--color-text)] text-white font-bold text-[14px] hover:opacity-90 transition cursor-pointer">View gap report</button>
          <button id="ga-reset" class="text-[12px] text-slate-400 underline cursor-pointer bg-transparent border-0">Reset</button>
        </div>
      </div>`;
  };

  const checklistHTML = () => `
    <p class="text-[14px] text-slate-600 max-w-[680px]">Check off the guardrails your organization has <strong>actively enforced</strong> today (deny in place, not "on the roadmap"). Be honest — the gap report is where this gets useful.</p>
    ${data.phases.map(p => `
      <section class="border border-black/5 rounded-2xl bg-white overflow-hidden">
        <div class="px-[18px] py-3 flex items-center gap-3 border-b border-[#f0f2fa]" style="background:${p.color}08">
          <span class="${MONO} tracking-[0.14em] text-[11px]" style="color:${p.color}">Phase 0${p.n}</span>
          <span class="font-bold text-[15px] text-[var(--color-text)]">${esc(p.name)}</span>
        </div>
        ${p.groups.map(key => {
          const g = data.groups[key];
          const list = groupControls(key);
          const haveN = list.filter(c => state.have.has(c.id)).length;
          return `
            <div class="border-b border-[#f0f2fa] last:border-b-0">
              <div class="flex items-center gap-2.5 px-[18px] py-2.5">
                <button data-acc="${key}" class="flex-1 flex items-center gap-2.5 bg-transparent border-0 cursor-pointer text-left p-0" aria-expanded="false">
                  <span data-chev="${key}" class="text-slate-400 text-[12px] transition-transform duration-150 inline-block">›</span>
                  <span class="font-semibold text-[14px] text-[var(--color-text)]">${esc(g ? g.label : key)}</span>
                  <span data-gcount="${key}" class="${MONO} text-[10px] ${haveN === list.length ? 'text-[#22b07d]' : 'text-slate-400'}">${haveN}/${list.length}</span>
                </button>
                <button data-all="${key}" class="bg-transparent border border-black/10 rounded-full px-3 py-1 cursor-pointer text-[11.5px] font-semibold text-slate-600">${haveN < list.length ? 'All' : 'None'}</button>
              </div>
              <div data-gbody="${key}" hidden class="grid gap-0.5 pl-[38px] pr-[18px] pb-3 pt-0.5">
                ${list.map(c => `
                  <label data-row="${c.id}" class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer" style="background:${state.have.has(c.id) ? '#22b07d0d' : 'transparent'}">
                    <input type="checkbox" data-cid="${c.id}" ${state.have.has(c.id) ? 'checked' : ''} class="w-[15px] h-[15px] flex-none accent-[#22b07d]">
                    <span class="text-[13.5px] text-[var(--color-text)] flex-1">${esc(c.name)}</span>
                    ${sevBadge(c.sev)}
                  </label>`).join('')}
              </div>
            </div>`;
        }).join('')}
      </section>`).join('')}`;

  const renderAssess = () => {
    root.innerHTML = `
      <div data-ga-assess class="grid gap-6">${scoreboardHTML()}<div class="grid gap-3.5">${checklistHTML()}</div></div>
      <div data-ga-report hidden></div>`;
  };

  // ---------- targeted updates ----------
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const updateScore = () => {
    const cov = coverage(state.have, data.controls, data.phases);
    const fill = q<SVGCircleElement>('#ga-cov-fill');
    if (fill) {
      const r = (92 - 9) / 2, C = 2 * Math.PI * r;
      fill.setAttribute('stroke-dasharray', `${C * Math.min(1, Math.max(0, cov.pct))} ${C}`);
      fill.setAttribute('stroke', covColor(cov.pct));
    }
    const pctEl = q<HTMLElement>('#ga-cov-pct');
    if (pctEl) pctEl.textContent = String(Math.round(cov.pct * 100));
    for (const p of cov.perPhase) {
      const bar = q<HTMLElement>(`[data-phase-fill="${p.n}"]`);
      if (bar) bar.style.width = `${p.pct * 100}%`;
      const txt = q<HTMLElement>(`[data-phase-pct="${p.n}"]`);
      if (txt) txt.textContent = `${Math.round(p.pct * 100)}%`;
    }
  };
  const updateGroup = (key: string) => {
    const list = groupControls(key);
    const haveN = list.filter(c => state.have.has(c.id)).length;
    const count = q<HTMLElement>(`[data-gcount="${key}"]`);
    if (count) {
      count.textContent = `${haveN}/${list.length}`;
      count.classList.toggle('text-[#22b07d]', haveN === list.length);
      count.classList.toggle('text-slate-400', haveN !== list.length);
    }
    const pill = q<HTMLElement>(`[data-all="${key}"]`);
    if (pill) pill.textContent = haveN < list.length ? 'All' : 'None';
  };
  const updateRow = (id: string) => {
    const row = q<HTMLElement>(`[data-row="${id}"]`);
    if (row) row.style.background = state.have.has(id) ? '#22b07d0d' : 'transparent';
    const box = q<HTMLInputElement>(`[data-cid="${id}"]`);
    if (box) box.checked = state.have.has(id);
  };
  const updateAllRows = () => {
    for (const c of data.controls) updateRow(c.id);
    for (const key of Object.keys(data.groups)) updateGroup(key);
    updateScore();
  };

  // ---------- report view (the 8-section arc) ----------
  const reportHTML = (): string => {
    const now = new Date();
    const nowIso = now.toISOString();
    const dateLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cov = coverage(state.have, data.controls, data.phases);
    const pctInt = Math.round(cov.pct * 100);
    const tier = verdictTier(cov.pct);
    const tamper = auditTamperGaps(state.have, data.auditTamperIds, data.controls);
    const mand = mandatoryGaps(state.have, data.controls);
    const fwGaps = frameworkGaps(state.have, data.controls, data.frameworks);
    const worstFw = [...fwGaps].sort((a, b) => b.missing - a.missing)[0];
    const missing = topMissing(state.have, data.controls);
    const orgGaps = orgScopeGapCount(state.have, data.controls);
    const aiHave = data.aiControlIds.filter(id => state.have.has(id)).length;
    const aiTotal = data.aiControlIds.length;
    const days = state.audit ? daysUntilMonth(nowIso, state.audit) : null;

    /* ===== §1 — verdict masthead ===== */
    const masthead = (): string => {
      const tierRing: Record<string, string> = { open: GR.amber, foundation: GR.brand, strong: GR.green };
      const phaseBars = cov.perPhase.map(p => {
        const pInt = Math.round(p.pct * 100);
        const zero = pInt === 0;
        return `<div style="flex:1;display:grid;gap:6px;justify-items:center;min-width:72px">
          ${grMono(`${pInt}%`, { size: 11, color: zero ? GR.faint : GR.ink, ls: '0.04em', weight: 600, extra: 'font-variant-numeric:tabular-nums' })}
          <div style="width:100%;max-width:54px;height:64px;border-radius:8px;background:${GR.track};position:relative;overflow:hidden">
            <div style="position:absolute;bottom:0;left:0;right:0;height:${pInt}%;background:${p.color};border-radius:${pInt === 100 ? '8px' : '0 0 8px 8px'}"></div>
          </div>
          <div style="display:grid;gap:1px;justify-items:center">
            ${grMono(`Phase ${p.n}`, { size: 9.5, color: p.color, ls: '0.1em', weight: 600 })}
            <span style="font-size:10.5px;color:${GR.muted};text-align:center">${esc(p.name)}</span>
          </div>
        </div>`;
      }).join('');
      return `<header class="gr-masthead" style="display:grid;gap:26px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:9px">${lockMark(22)}${grMono('Instasecure', { size: 12, color: GR.ink, ls: '0.2em', weight: 600 })}</div>
          <span class="gr-stamp" style="padding:5px 12px;border-radius:6px;border:1.5px solid ${GR.amber};background:${GR.amber}0d">${grMono('Self-attested', { size: 10.5, color: '#b26a0f', ls: '0.16em', weight: 600 })}</span>
        </div>
        <div style="display:grid;gap:10px">
          ${grMono(`Self-attested posture snapshot · ${esc(dateLabel)}`, { size: 11.5, color: GR.brand, ls: '0.2em', weight: 600 })}
          <h1 style="margin:0;font-family:var(--font-serif);font-size:clamp(33px,5vw,42px);font-weight:600;letter-spacing:-0.02em;line-height:1.08;color:${GR.ink}">Guardrails Gap Report</h1>
        </div>
        <div class="gr-verdict" style="display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;padding-top:6px">
          ${ringSVG(cov.pct, 132, 11, tierRing[tier], '', `<span style="font-family:var(--font-serif);font-size:38px;font-weight:600;color:${GR.ink};line-height:1">${pctInt}<span style="font-size:20px">%</span></span>${grMono('Coverage', { size: 9.5, color: GR.muted, ls: '0.14em' })}`)}
          <div style="display:grid;gap:10px">
            <p style="margin:0;font-family:var(--font-serif);font-size:20px;line-height:1.45;color:${GR.ink};text-wrap:pretty">${VERDICT_COPY[tier]}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${GR.body};text-wrap:pretty">Your self-attested coverage is <strong style="color:${GR.ink}">${pctInt}%</strong>. The number to trust is the scan-verified one: which guardrails are technically enforced, and where coverage still needs evidence.</p>
          </div>
        </div>
        <div style="display:grid;gap:12px;padding-top:4px">
          ${grMono('Coverage by phase', { size: 10.5, color: GR.muted, ls: '0.16em', weight: 600 })}
          <div class="gr-phasechart" style="display:flex;gap:14px;align-items:flex-end">${phaseBars}</div>
        </div>
      </header>`;
    };

    /* ===== §2 — attack-lifecycle coverage (the map) ===== */
    const renderLifecycle = (): string => {
      const cells = lifecycleView(state.have, data.lifecycle);
      const comp = attackCompleteness(state.have, data.chains, data.lifecycle);
      const mappedN = data.lifecycle.filter(t => t.populated).length;
      const line = `Of the <strong>${comp.techniques}</strong> techniques charted here, your self-attestation leaves <strong>${comp.openTechniques}</strong> open across <strong>${comp.openTactics}</strong> tactics; <strong>${comp.detectionOnly}</strong> are detection-only. A scan verifies which denies are actually enforced.`;

      const gridCells = cells.map((row, i) => {
        const idx = String(i + 1).padStart(2, '0');
        if (!row.populated) {
          return `<div class="gr-lc-cell is-tbd"><span class="gr-lc-idx">${idx}</span><span class="gr-lc-tactic">${esc(row.tactic)}</span><span class="gr-lc-tbd">Detection territory</span></div>`;
        }
        const anyOpen = row.closed < row.total;
        const sel = state.selectedStage === row.tactic;
        const dots = row.controls.map(c => `<span class="gr-lc-dot" title="${esc(c.control)} — ${esc(c.controlName)} (${c.state === 'closed' ? 'enforced' : 'open'})" style="${c.state === 'closed' ? `background:${GR.green}` : `background:#fff;border:2px solid ${GR.red}`}"></span>`).join('');
        return `<button type="button" class="gr-lc-cell${sel ? ' is-sel' : ''}" data-ga-stage="${esc(row.tactic)}" aria-pressed="${sel}" title="${esc(row.tactic)} — ${row.closed} of ${row.total} charted controls attested as enforced">
          <span class="gr-lc-idx">${idx}</span>
          <span class="gr-lc-tactic">${esc(row.tactic)}</span>
          <span class="gr-lc-ratio" style="color:${anyOpen ? tone(GR.red) : tone(GR.green)}">${row.closed}/${row.total}<small>enforced</small></span>
          <div class="gr-lc-dots">${dots}</div>
        </button>`;
      }).join('');

      let detail = '';
      const selRow = cells.find(r => r.tactic === state.selectedStage && r.populated);
      if (selRow) {
        const rows = selRow.controls.map(c => {
          const sc = data.storyMap[c.control] ?? null;
          const key = `lc:${selRow.tactic}:${c.control}`;
          const open = c.state === 'open';
          const storyOpen = state.expandedStories.has(key);
          const ctlColor = open ? tone(GR.red) : '#6d7290';
          return `<div class="gr-vstep${open ? ' is-open' : ''}${sc ? ' has-story' : ''}"${sc ? ` data-ga-story="${esc(key)}" role="button" tabindex="0" aria-expanded="${storyOpen}"` : ''} title="${esc(c.technique)} · ${esc(selRow.tactic)} — ${open ? 'open (not attested)' : 'enforced (attested)'}">
            <span class="gr-vnode">${stateIcon(c.state, 18)}</span>
            <div class="gr-vbody">
              <div class="gr-vrow1">
                <span class="gr-vlabel" style="color:${open ? GR.ink : GR.body};font-weight:${open ? 600 : 500}">${esc(c.controlName)}</span>
                ${sc ? storyCaret(storyOpen) : ''}
                <span class="gr-vctl" style="color:${ctlColor}">${esc(c.control)}</span>
              </div>
              <div class="gr-vrow2">
                <a class="gr-vtech gr-b2-link" href="${mitreUrl(c.technique)}" target="_blank" rel="noreferrer" style="color:${ctlColor}">${esc(c.technique)}</a>
              </div>
              ${sc && storyOpen ? storyBlock(sc) : ''}
            </div>
          </div>`;
        }).join('');
        detail = `<div class="gr-lc-detail">
          <div class="gr-lc-detail-head">
            ${grMono(esc(selRow.tactic), { size: 10, color: GR.slate, ls: '0.14em', weight: 600 })}
            ${grMono(`${selRow.closed}/${selRow.total} enforced`, { size: 10, color: GR.faint, ls: '0.06em' })}
            <button type="button" class="gr-lc-close" aria-label="Close stage detail" data-ga-stage-close>×</button>
          </div>
          ${rows}
        </div>`;
      }

      const inner = `
        <div class="gr-b2-lead" style="display:grid;gap:9px">
          <p style="margin:0;font-family:var(--font-serif);font-size:18.5px;line-height:1.5;color:${GR.ink};text-wrap:pretty">Every guardrail maps to MITRE ATT&amp;CK — and the catalog reaches past it.</p>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">InstaSecure's 122 preventive controls cover every MITRE ATT&amp;CK (cloud) technique a preventive guardrail can close, then go further into AWS-native data-perimeter controls the vendor-neutral matrix has no technique ID for.</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${GR.ink};font-weight:500;text-wrap:pretty">${line}</p>
          ${stateLegend()}
        </div>
        <div style="display:grid;gap:9px">
          <p style="margin:0;font-size:12.5px;line-height:1.55;color:${GR.muted};text-wrap:pretty">The full MITRE tactic progression. Each stage shows the charted preventive controls that break attacks there — thin stages are where exposure concentrates.<span class="gr-hint-screen"> Select a stage to see its controls.</span></p>
          <div class="gr-lc-grid">${gridCells}</div>
          ${detail}
          <p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">${mappedN} of ${data.lifecycle.length} stages carry charted preventive controls from the ATT&amp;CK v19.1 catalog — stages without one are detection territory.</p>
        </div>`;
      return grSection('02', 'Attack-lifecycle coverage', '', inner, 'gr-attack');
    };

    /* ===== §3 — real-adversary playbooks (the routes) ===== */
    const vStep = (s: PlaybookNode, i: number, actorId: string, sharedCount: number): string => {
      const open = s.state === 'open';
      const nc = s.state === 'no-control';
      const sc = s.scenario;
      const key = `pb:${actorId}:${i}`;
      const storyOpen = state.expandedStories.has(key);
      const labelColor = nc ? GR.slateDark : open ? GR.ink : GR.body;
      const ctlColor = nc ? GR.slate : open ? tone(GR.red) : '#6d7290';
      const techColor = open ? tone(GR.red) : nc ? GR.slate : '#6d7290';
      const ctlText = nc ? '△ scan / detect' : esc(s.control!) + (s.partial ? ' · partial' : '');
      const title = `${s.techniqueName} · ${s.tactic}\n${s.api}\n${nc ? 'No preventive guardrail exists — detection / scan territory.' : (open ? 'Open — not attested: ' : 'Closed — attested: ') + (s.controlName ?? '') + (s.sev ? ` (${s.sev})` : '') + (s.partial ? ' — partial coverage' : '')}`;
      const sharedTag = sharedCount >= 2 ? `<span class="gr-vshared" title="This open control appears in ${sharedCount} of 3 charted playbooks.">×${sharedCount} playbooks</span>` : '';
      return `<div class="gr-vstep${open ? ' is-open' : nc ? ' is-nc' : ''}${sc ? ' has-story' : ''}"${sc ? ` data-ga-story="${esc(key)}" role="button" tabindex="0" aria-expanded="${storyOpen}"` : ''} title="${esc(title)}">
        <span class="gr-vnode">${stateIcon(s.state, 18)}</span>
        <div class="gr-vbody">
          <div class="gr-vrow1">
            <span class="gr-vlabel" style="color:${labelColor};font-weight:${open ? 700 : 500}">${esc(s.label)}</span>
            ${sc ? storyCaret(storyOpen) : ''}
            ${sharedTag}
            <span class="gr-vctl" style="color:${ctlColor}">${ctlText}</span>
          </div>
          <div class="gr-vrow2">
            <a class="gr-vtech gr-b2-link" href="${mitreUrl(s.technique)}" target="_blank" rel="noreferrer" style="color:${techColor}">${esc(s.technique)}</a>
            <span class="gr-vapi">${esc(s.api)}</span>
          </div>
          ${sc && storyOpen ? storyBlock(sc) : ''}
        </div>
      </div>`;
    };

    const renderPlaybooks = (): string => {
      const views = playbookView(state.have, data.chains, data.storyMap);
      const shared = sharedOpenGaps(state.have, data.chains);
      const cards = views.map(v => {
        const actor = data.actors[v.id];
        if (!actor) return '';
        const collapsed = state.collapsedActors.has(v.id);
        const openState = !collapsed;
        const cite = [actor.mitreGroup ? `MITRE ${actor.mitreGroup}` : 'No MITRE group designation', ...actor.sources.map(s => `${s.name} (${s.date})`)].join(' · ');
        const spark = collapsed ? `<span class="gr-spark" aria-hidden="true">${v.steps.map(s => stateIcon(s.state, 12)).join('')}</span>` : '';
        const openPill = v.openLinks > 0
          ? `<span style="padding:3px 11px;border-radius:999px;background:${GR.red}14">${grMono(`${v.openLinks} of ${v.steps.length} links open`, { size: 9.5, color: tone(GR.red), ls: '0.1em', weight: 600 })}</span>`
          : `<span style="padding:3px 11px;border-radius:999px;background:${GR.green}14">${grMono(v.detectionOnly > 0 ? 'All preventable links closed' : 'Severed — all links closed', { size: 9.5, color: tone(GR.green), ls: '0.1em', weight: 600 })}</span>`;
        const ncPill = v.detectionOnly > 0 ? `<span style="padding:3px 11px;border-radius:999px;border:1px solid ${GR.slate}33">${grMono(`△ ${v.detectionOnly} detection-only`, { size: 9.5, color: GR.slate, ls: '0.1em', weight: 600 })}</span>` : '';
        const pop = state.openPopover === v.id ? infoPop(actor) : '';
        let prevTactic: string | null = null;
        const stepRows = v.steps.map((s, i) => {
          let out = '';
          if (s.tactic !== prevTactic) { out += `<div class="gr-tactic-mini">${esc(s.tactic)}</div>`; prevTactic = s.tactic; }
          out += vStep(s, i, v.id, s.control && s.state === 'open' ? (shared[s.control] || 0) : 0);
          return out;
        }).join('');
        const meta = `${v.steps.length} documented moves · ${v.tacticsCount}${actor.flagship ? ` of ${data.lifecycle.length}` : ''} tactics`;
        return `<div class="gr-actor" data-open="${openState}">
          <div class="gr-actor-hrow">
            <button type="button" class="gr-actor-toggle" data-ga-actor="${esc(v.id)}" aria-expanded="${openState}">
              <svg class="gr-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 L7.5 5 L3 8.5" stroke="#8a8fa8" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              <span class="gr-actor-name">${esc(actor.name)}</span>
            </button>
            <span class="gr-info">
              <button type="button" class="gr-info-btn" data-ga-popover="${esc(v.id)}" aria-expanded="${state.openPopover === v.id}" aria-label="${esc(actor.name)} — aliases, MITRE group, sources">i</button>
              ${pop}
            </span>
            <span class="gr-actor-meta">${esc(meta)}</span>
            <span style="margin-left:auto;display:inline-flex;gap:7px;align-items:center;flex-shrink:0">${spark}${openPill}${ncPill}</span>
          </div>
          <div class="gr-cite">${esc(cite)}</div>
          <div class="gr-actor-body">
            <p class="gr-actor-premise">${esc(actor.premise)}</p>
            <div class="gr-vsteps">${stepRows}</div>
          </div>
        </div>`;
      }).join('');

      const inner = `
        <div class="gr-b2-lead" style="display:grid;gap:9px">
          <p style="margin:0;font-family:var(--font-serif);font-size:18.5px;line-height:1.5;color:${GR.ink};text-wrap:pretty">How named adversaries walk the map.</p>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">Documented cloud campaigns from published threat research, replayed step by step against your self-attestation. Every move is cited; every open link names the missing preventive control. Steps with a dotted label expand to the scenario behind them.</p>
        </div>
        <div style="display:grid;gap:10px">${cards}</div>
        <p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">Technique IDs link to the MITRE ATT&amp;CK® Enterprise (IaaS) matrix; actor attributions are dated, cited claims. Open = not attested — not proven exploitable. A scan verifies which denies are actually enforced.</p>`;
      return grSection('03', 'Real-adversary playbooks', '', inner, 'gr-attack');
    };

    /* ===== §4 — table stakes (mandatory floor) ===== */
    const tableStakes = (): string => {
      if (mand.length === 0) {
        return grSection('04', 'Table stakes', '', grAllClear(`All ${mandatoryTotal} mandatory controls attested. That's the floor — the blocks below are the walls.`));
      }
      const items = mand.map(c => {
        const g = data.groups[c.group];
        const phaseColor = g ? (data.phases[g.phase - 1]?.color ?? GR.slate) : GR.slate;
        const pills = g ? `<span style="display:inline-flex;gap:5px;align-items:center;flex-shrink:0">
          <span style="padding:1.5px 8px;border-radius:999px;background:${phaseColor}14">${grMono(`Phase ${g.phase}`, { size: 8.5, color: phaseColor, ls: '0.08em', weight: 600 })}</span>
          <span style="padding:1.5px 8px;border-radius:999px;border:1px solid ${GR.slate}33">${grMono(esc(g.short), { size: 8.5, color: GR.slate, ls: '0.08em', weight: 600 })}</span>
        </span>` : '';
        return `<div style="display:grid;grid-template-columns:6px minmax(0,1fr);gap:10px;align-items:start">
          <span style="width:6px;height:6px;border-radius:999px;background:${GR.red};margin-top:7px"></span>
          <span style="display:flex;gap:3px 8px;align-items:center;flex-wrap:wrap;min-width:0">
            <span style="font-size:13px;line-height:1.5;color:${GR.body};font-weight:500;flex:0 1 auto;min-width:0">${esc(c.name)}</span>
            ${pills}
          </span>
        </div>`;
      }).join('');
      const inner = `
        <div style="display:grid;gap:6px">
          <p style="margin:0;font-family:var(--font-serif);font-size:18.5px;line-height:1.5;color:${GR.ink};text-wrap:pretty">Before framework mapping, settle the floor: <strong style="font-weight:600;color:${tone(GR.red)}">${mand.length}/${mandatoryTotal}</strong> of InstaSecure's day-one critical baseline are not attested as enforced.</p>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body}">Mandatory = InstaSecure's own day-one baseline — not a regulatory claim. All ${mandatoryTotal} are critical severity; there is no compensating-control story for these.</p>
        </div>
        <div class="gr-mandatory-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:9px 18px">${items}</div>`;
      return grSection('04', 'Table stakes', '', inner);
    };

    /* ===== §5 — compliance evidence queue (+ evidence-integrity callout) ===== */
    const compliance = (): string => {
      const allZero = fwGaps.every(f => f.missing === 0);
      const auditRight = `<div class="gr-audit-input" style="display:flex;align-items:center;gap:9px">
        ${grMono('Audit window', { size: 10, color: GR.muted, ls: '0.12em', weight: 600 })}
        <input id="ga-audit" type="month" value="${esc(state.audit)}" aria-label="Audit window month" style="font-family:var(--font-mono);font-size:12px;color:${GR.ink};padding:5px 9px;border-radius:8px;border:1px solid ${GR.border};background:#fff">
      </div>`;
      const clearPill = allZero ? `<div style="justify-self:start"><span style="display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:${GR.green}14"><svg width="11" height="11" viewBox="0 0 14 14"><path d="M2.5 7.4 L5.6 10.4 L11.5 3.8" fill="none" stroke="${GR.green}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>${grMono('Evidence queue clear', { size: 10, color: tone(GR.green), ls: '0.14em', weight: 600 })}</span></div>` : '';
      const legendChips = `<span style="display:flex;gap:14px;justify-content:flex-end;align-items:center">
        <span style="display:inline-flex;gap:6px;align-items:center"><span style="width:14px;height:7px;border-radius:999px;background:#39406a"></span>${grMono('Attested', { size: 8.5, color: GR.muted, ls: '0.1em', weight: 600 })}</span>
        <span style="display:inline-flex;gap:6px;align-items:center"><span style="width:14px;height:7px;border-radius:999px;background:repeating-linear-gradient(135deg,${GR.amber}66 0 3px,${GR.amber}1f 3px 6px)"></span>${grMono('Awaiting evidence', { size: 8.5, color: GR.muted, ls: '0.1em', weight: 600 })}</span>
      </span>`;
      const headerRow = `<div class="gr-fw-row" style="display:grid;grid-template-columns:118px 90px 1fr;gap:14px;align-items:center">
        ${grMono('Framework', { size: 9.5, color: GR.faint, ls: '0.12em', weight: 600 })}
        ${grMono('Awaiting', { size: 9.5, color: GR.faint, ls: '0.12em', weight: 600 })}
        ${legendChips}
      </div>`;
      const rows = fwGaps.map(f => {
        const attestedPct = f.total ? ((f.total - f.missing) / f.total) * 100 : 0;
        const awaitingPct = f.total ? (f.missing / f.total) * 100 : 0;
        const countColor = f.missing === 0 ? tone(GR.green) : '#b26a0f';
        return `<div class="gr-fw-row" style="display:grid;grid-template-columns:118px 90px 1fr;gap:14px;align-items:center">
          ${grMono(esc(f.label), { size: 11, color: GR.ink, ls: '0.05em', weight: 600 })}
          <span style="font-size:13.5px;color:${countColor};font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap">${f.missing}<span style="color:${GR.muted};font-weight:500"> of ${f.total}</span></span>
          <div style="height:9px;border-radius:999px;background:${GR.track};overflow:hidden;display:flex" role="img" aria-label="${f.missing} of ${f.total} mapped ${esc(f.label)} controls still awaiting enforcement evidence">
            <div style="width:${attestedPct}%;height:100%;background:#39406a"></div>
            <div style="width:${awaitingPct}%;height:100%;background:repeating-linear-gradient(135deg,${GR.amber}66 0 3px,${GR.amber}1f 3px 6px)"></div>
          </div>
        </div>`;
      }).join('');
      const countdown = (state.audit && days !== null && !allZero && worstFw) ? `<div style="display:grid;gap:8px;padding:15px 18px;border-radius:12px;border:1px solid ${GR.amber}14;background:${GR.amber}08">
        ${grMono('Audit countdown', { size: 10.5, color: '#b26a0f', ls: '0.16em', weight: 600 })}
        ${days >= 0
          ? `<p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.ink};text-wrap:pretty"><strong>${worstFw.missing} ${esc(worstFw.label)}</strong> mapped controls are not attested as enforced. If your audit window starts in <strong>${esc(fmtMonth(state.audit))}</strong>, use the remaining <strong>${days} days</strong> to triage the largest evidence queue first.</p>`
          : `<p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.ink}">Your last audit window has passed — the next one is closer than it feels.</p>`}
      </div>` : '';
      const tamperCallout = tamper.missing > 0 ? `<div class="gr-b2-callout" style="display:grid;gap:8px;padding:16px 18px;border-radius:12px;border:1px solid ${GR.purple}14;background:${GR.purple}08">
        ${grMono('Evidence integrity', { size: 10.5, color: tone(GR.purple), ls: '0.16em', weight: 600 })}
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.ink};text-wrap:pretty">You did not attest enforcement for <strong>${tamper.missing}/${tamper.total}</strong> controls tagged audit-tampering, including <strong>${tamper.missingCritical} critical</strong> controls. Treat those as priority evidence-integrity checks before the audit.</p>
      </div>` : '';
      const inner = `
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">This is not a framework pass/fail score. It is the evidence queue: mapped preventive controls you did not attest as technically enforced. Auditors sample technical enforcement, not policy PDFs.</p>
        ${clearPill}
        <div style="display:grid;gap:9px">${headerRow}${rows}</div>
        <p style="margin:0;font-size:11.5px;color:${GR.muted}">Solid = attested as enforced. Hatched = still awaiting enforcement evidence — the work left before the audit. Not a pass/fail gauge.</p>
        ${countdown}
        ${tamperCallout}`;
      return grSection('05', 'Compliance evidence queue', auditRight, inner);
    };

    /* ===== §6 — top missing controls ===== */
    const topMissingSec = (): string => {
      if (missing.length === 0) {
        return grSection('06', 'Top missing controls', '', grAllClear('No critical or high-severity gaps left in your attestation. Now verify it — a scan confirms enforcement across every account, OU, and region.'));
      }
      const rows = missing.slice(0, 20);
      const screenMore = missing.length - Math.min(8, rows.length);
      const printMore = missing.length - rows.length;
      const rowHtml = rows.map((c, i) => `<div class="gr-missing-row${i >= 8 ? ' gr-row-printonly' : ''}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:#fff;border:1px solid ${GR.border}">
        <span style="width:94px;flex-shrink:0;display:inline-flex">${grSevBadge(c.sev)}</span>
        <span style="flex:1;font-size:13.5px;font-weight:500;color:${GR.ink};line-height:1.45">${esc(c.name)}</span>
        ${grImplPill(c.impl)}
      </div>`).join('');
      const inner = `
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty"><strong style="color:${GR.ink}">${orgGaps}</strong> of your open gaps are org-scope controls. Your self-attested score says what you believe is deployed; a scan should verify whether org-level guardrails are enforced across the intended AWS Organization coverage.</p>
        <div style="display:grid;gap:7px">${rowHtml}</div>
        ${screenMore > 0 ? `<p class="gr-more-screen" style="margin:0;font-size:11.5px;color:${GR.muted}">…and ${screenMore} more.</p>` : ''}
        ${printMore > 0 ? `<p class="gr-more-print" style="margin:0;font-size:11.5px;color:${GR.muted}">…and ${printMore} more.</p>` : ''}`;
      return grSection('06', 'Top missing controls', '', inner);
    };

    /* ===== §7 — AI callout (conditional, verbatim copy) ===== */
    const aiSection = (): string => {
      if (aiHave >= aiTotal) return '';
      return `<section class="gr-section" style="display:grid;gap:0">
        <div style="display:grid;gap:8px;padding:18px 20px;border-radius:12px;border:1px solid ${GR.purple}14;background:${GR.purple}08">
          <div style="display:flex;align-items:baseline;gap:14px">${grMono('07', { size: 11, color: GR.faint, ls: '0.18em', weight: 600 })}${grMono('AI guardrails', { size: 10.5, color: tone(GR.purple), ls: '0.16em', weight: 600 })}</div>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.ink};text-wrap:pretty"><strong>${aiHave}/${aiTotal}</strong> AI guardrails enforced. Your genAI adoption may be ahead of your genAI governance — that's a board question this quarter.</p>
        </div>
      </section>`;
    };

    /* ===== §8 — close (CTA + Formspree email gate) ===== */
    const closeSection = (): string => {
      const gate = state.gateOpen ? `<form id="ga-gate-form" class="gr-gate" style="display:grid;gap:8px">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <label for="ga-gate-email" class="sr-only">Work email</label>
          <input id="ga-gate-email" type="email" required placeholder="you@company.com" value="${esc(state.emailDraft)}" ${state.gateBusy ? 'disabled' : ''} aria-label="Work email" style="flex:1;min-width:200px;padding:11px 14px;border-radius:10px;border:1px solid ${state.gateError ? GR.red : '#ffffff3d'};background:#ffffff14;color:#fff;font-family:var(--font-sans);font-size:14px;outline:none">
          <button type="submit" ${state.gateBusy ? 'disabled' : ''} style="padding:11px 20px;border-radius:10px;border:none;background:${state.gateBusy ? '#ffffff33' : '#fff'};color:${GR.ink};font-family:var(--font-sans);font-size:13.5px;font-weight:700;cursor:${state.gateBusy ? 'default' : 'pointer'}">${state.gateBusy ? 'Sending…' : 'Send report'}</button>
          <button type="button" id="ga-gate-cancel" ${state.gateBusy ? 'disabled' : ''} style="padding:11px 12px;border-radius:10px;border:none;background:transparent;color:#ffffff8c;font-family:var(--font-sans);font-size:13px;cursor:pointer">Cancel</button>
        </div>
        ${state.gateError ? `<span style="font-size:12.5px;color:${GR.red};font-weight:600">Couldn't send — try again</span>` : ''}
      </form>` : '';
      const secondaryBtn = state.gateOpen ? '' : `<button type="button" id="ga-export" class="gr-cta-secondary" style="padding:12px 22px;border-radius:11px;background:transparent;border:1px solid #ffffff3d;color:#fff;font-family:var(--font-sans);font-size:14px;font-weight:600;cursor:pointer">Email me this report (PDF)</button>`;
      const inner = `<div class="gr-close-panel" style="display:grid;gap:20px;padding:28px 30px;border-radius:16px;background:${GR.ink};color:#fff">
        <p style="margin:0;font-size:14.5px;line-height:1.65;color:#ffffffd9;text-wrap:pretty">Every gap listed here maps to an SCP, RCP, or VPC endpoint policy. The scan turns the report into an artifact checklist: which policy controls are present, missing, or not enforced.</p>
        <div class="gr-cta-row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch">
          <a href="/contact" class="gr-cta-primary" style="display:grid;gap:2px;padding:12px 22px;border-radius:11px;background:${GR.brand};color:#fff;text-decoration:none;box-shadow:0 10px 24px -10px #4d66e099">
            <span style="font-size:14.5px;font-weight:700">Verify with a real scan</span>
            <span style="font-size:11.5px;color:#ffffffb3">See your actual number — not the attested one</span>
          </a>
          ${secondaryBtn}
        </div>
        ${gate}
      </div>
      <div style="display:grid;gap:5px;padding-top:2px">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${GR.muted}">Every control above ships as an enforced, org-wide guardrail. Zero code.</p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${GR.muted}">This report reflects what you attested. Attestation ≠ enforcement — a real scan verifies every control across every account, OU, and region.</p>
      </div>`;
      return grSection('08', 'From attestation to evidence', '', inner, 'gr-close');
    };

    const printHeader = `<div class="gr-print-header">
      <div style="display:flex;align-items:center;gap:9px">${lockMark(20)}<span style="font-family:var(--font-sans);font-size:13.5px;font-weight:700;color:${GR.ink}">InstaSecure</span><span style="font-family:var(--font-sans);font-size:13.5px;font-weight:400;color:${GR.muted}">— Guardrails Gap Report</span></div>
      <div style="display:grid;gap:2px;justify-items:end">${grMono(esc(dateLabel), { size: 10, color: GR.body, ls: '0.08em' })}<span style="font-family:var(--font-mono);font-size:10px;color:${GR.faint};letter-spacing:0.06em">instasecure.ai/learn/guardrails-assessment</span></div>
    </div>`;
    const backBtn = `<div class="gr-backlink" style="padding-bottom:16px"><button id="ga-back" type="button" style="font-family:var(--font-mono);font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:${GR.body};background:none;border:0;cursor:pointer;padding:0">← Back to checklist</button></div>`;

    return `<div style="max-width:920px;margin:0 auto">
      ${printHeader}
      ${backBtn}
      <article class="gr-sheet" aria-label="Guardrails Gap Report">
        ${masthead()}
        ${renderLifecycle()}
        ${renderPlaybooks()}
        ${tableStakes()}
        ${compliance()}
        ${topMissingSec()}
        ${aiSection()}
        ${closeSection()}
      </article>
    </div>`;
  };

  const showView = (view: 'assess' | 'report') => {
    state.view = view;
    const assess = q<HTMLElement>('[data-ga-assess]');
    const report = q<HTMLElement>('[data-ga-report]');
    if (!assess || !report) return;
    if (view === 'report') {
      report.innerHTML = reportHTML();
      assess.hidden = true; report.hidden = false;
      root.scrollIntoView({ block: 'start', behavior: prefersReduced ? 'auto' : 'smooth' });
    } else {
      assess.hidden = false; report.hidden = true; report.innerHTML = '';
    }
  };
  const rerenderReport = () => {
    const report = q<HTMLElement>('[data-ga-report]');
    if (report && state.view === 'report') report.innerHTML = reportHTML();
  };

  // ---------- export / gate ----------
  const doExport = () => {
    if (!data.formspreeEndpoint || state.email) { window.print(); return; }
    state.gateOpen = true; state.gateError = false;
    rerenderReport();
    q<HTMLInputElement>('#ga-gate-email')?.focus();
  };
  const submitGate = async (form: HTMLFormElement) => {
    const input = form.querySelector<HTMLInputElement>('#ga-gate-email');
    if (!input || state.gateBusy || !data.formspreeEndpoint) return;
    state.emailDraft = input.value;
    state.gateBusy = true; state.gateError = false;
    rerenderReport();
    const cov = coverage(state.have, data.controls, data.phases);
    const threats = openThreatWeights(state.have, data.controls);
    const topThreatKey = threats[0]?.[0];
    try {
      const res = await fetch(data.formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: state.emailDraft,
          _subject: 'Guardrails Assessment report',
          source: 'guardrails-assessment',
          coverage: Math.round(cov.pct * 100),
          missing_mandatory: mandatoryGaps(state.have, data.controls).length,
          top_threat: topThreatKey ? (data.threats[topThreatKey]?.label ?? topThreatKey) : 'none',
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      state.email = state.emailDraft;
      writeJSON(EMAIL_KEY, state.email);
      state.gateOpen = false; state.gateBusy = false;
      rerenderReport();
      window.print();
    } catch {
      state.gateBusy = false; state.gateError = true;
      rerenderReport();
    }
  };

  const toggleSet = (set: Set<string>, key: string) => { if (set.has(key)) set.delete(key); else set.add(key); };

  // ---------- event delegation (bound once) ----------
  const onClick = (e: Event) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const acc = t.closest<HTMLElement>('[data-acc]');
    if (acc) {
      const key = acc.dataset.acc!;
      const prev = state.openGroup;
      if (prev && prev !== key) {
        const pb = q<HTMLElement>(`[data-gbody="${prev}"]`); if (pb) pb.hidden = true;
        const pc = q<HTMLElement>(`[data-chev="${prev}"]`); if (pc) pc.style.transform = '';
        q<HTMLElement>(`[data-acc="${prev}"]`)?.setAttribute('aria-expanded', 'false');
      }
      const open = state.openGroup === key;
      state.openGroup = open ? null : key;
      const body = q<HTMLElement>(`[data-gbody="${key}"]`); if (body) body.hidden = open;
      const chev = q<HTMLElement>(`[data-chev="${key}"]`); if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
      acc.setAttribute('aria-expanded', open ? 'false' : 'true');
      return;
    }
    const all = t.closest<HTMLElement>('[data-all]');
    if (all) {
      const key = all.dataset.all!;
      const ids = groupControls(key).map(c => c.id);
      const haveAll = ids.every(id => state.have.has(id));
      if (haveAll) ids.forEach(id => state.have.delete(id));
      else ids.forEach(id => state.have.add(id));
      persistHave();
      ids.forEach(updateRow); updateGroup(key); updateScore();
      return;
    }
    if (t.closest('#ga-open-report')) { showView('report'); return; }
    if (t.closest('#ga-back')) { showView('assess'); return; }
    if (t.closest('#ga-reset')) {
      state.have.clear(); persistHave(); updateAllRows();
      return;
    }
    if (t.closest('#ga-gate-cancel')) { state.gateOpen = false; state.emailDraft = ''; state.gateError = false; rerenderReport(); return; }
    if (t.closest('#ga-export')) { doExport(); return; }
    // report links (technique / source / primary CTA) navigate natively
    if (t.closest('a[href]')) return;
    // §2/§3 interactions
    if (t.closest('[data-ga-stage-close]')) { state.selectedStage = null; rerenderReport(); return; }
    const stage = t.closest<HTMLElement>('[data-ga-stage]');
    if (stage) { const tac = stage.dataset.gaStage!; state.selectedStage = state.selectedStage === tac ? null : tac; rerenderReport(); return; }
    const story = t.closest<HTMLElement>('[data-ga-story]');
    if (story) { toggleSet(state.expandedStories, story.dataset.gaStory!); rerenderReport(); return; }
    const actorEl = t.closest<HTMLElement>('[data-ga-actor]');
    if (actorEl) { toggleSet(state.collapsedActors, actorEl.dataset.gaActor!); rerenderReport(); return; }
    const popEl = t.closest<HTMLElement>('[data-ga-popover]');
    if (popEl) { const id = popEl.dataset.gaPopover!; state.openPopover = state.openPopover === id ? null : id; rerenderReport(); return; }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target instanceof Element ? e.target : null;
    // links inside story rows navigate natively (mirrors the click path)
    if (t?.closest('a[href]')) return;
    const story = t?.closest<HTMLElement>('[data-ga-story]');
    if (story) { e.preventDefault(); toggleSet(state.expandedStories, story.dataset.gaStory!); rerenderReport(); }
  };
  const onChange = (e: Event) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t instanceof HTMLInputElement && t.dataset.cid) {
      const id = t.dataset.cid;
      if (t.checked) state.have.add(id); else state.have.delete(id);
      persistHave();
      updateRow(id);
      const ctrl = controlsById.get(id);
      if (ctrl) updateGroup(ctrl.group);
      updateScore();
      return;
    }
    if (t instanceof HTMLInputElement && t.id === 'ga-audit') {
      state.audit = t.value;
      writeJSON(AUDIT_KEY, state.audit);
      rerenderReport();
    }
  };
  const onSubmit = (e: Event) => {
    const t = e.target instanceof Element ? e.target : null;
    const form = t?.closest<HTMLFormElement>('#ga-gate-form');
    if (!form) return;
    e.preventDefault();
    void submitGate(form);
  };
  // popover: close on outside pointer-down (mousedown fires before click) or Escape
  const onDocPointerDown = (e: Event) => {
    if (!state.openPopover) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && t.closest('.gr-info')) return;
    state.openPopover = null; rerenderReport();
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && state.openPopover) { state.openPopover = null; rerenderReport(); }
  };
  // print: single-source body.is-print (mirrors the design's beforeprint/afterprint toggle)
  const onBeforePrint = () => document.body.classList.add('is-print');
  const onAfterPrint = () => document.body.classList.remove('is-print');

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousedown', onDocPointerDown);
  document.addEventListener('keydown', onDocKey);
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);
  renderAssess();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousedown', onDocPointerDown);
    document.removeEventListener('keydown', onDocKey);
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
    document.body.classList.remove('is-print');
  };
}

// severity badge for the assess checklist (kept as-is; report §6 uses grSevBadge)
function sevBadge(sev: string): string {
  const m = SEV_META[sev] ?? SEV_META.low;
  return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] flex-none" style="color:${m.color};background:${m.color}14"><span class="w-1.5 h-1.5 rounded-full" style="background:${m.color}"></span>${m.label}</span>`;
}
