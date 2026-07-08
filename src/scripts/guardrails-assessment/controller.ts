import {
  estimateCoverage, estimateCoveredIds, verdictTier,
  type PhaseRef, type FrameworkRef, type CatalogRef,
} from './assess';
import type { ActorMeta, PlaybookStep, LifecycleTactic } from '@/data/guardrails/attack-chains';

export interface RepControlLite {
  id: string; name: string; sev: string;
  tier: 'mandatory' | 'strongly_recommended' | 'elective';
  group: string;
}

export interface AssessData {
  catalog: CatalogRef;
  groups: Record<string, { label: string; short: string; phase: number; blurb: string }>;
  phases: PhaseRef[];
  representative: RepControlLite[];
  frameworks: FrameworkRef[];
  // Still shipped in the payload but unused — the email/PDF gate was removed (fix 6).
  formspreeEndpoint: string | null;
  // attack sections (§1 lifecycle + §2 playbooks) — shared capability content, projected
  // against the per-group estimate at render time via estimateCoveredIds.
  actors: Record<string, ActorMeta>;
  chains: { id: string; steps: PlaybookStep[] }[];
  lifecycle: LifecycleTactic[];
  storyMap: Record<string, { title: string; explain: string }>;
}

// v2 key — the model changed from a per-control Set to a per-group level map, so old data is ignored.
const LEVELS_KEY = 'arena.assess.v2';

const LEVEL_LABELS = ['None', 'Some', 'Most', 'All'];

// Org-profile presets — one click sets all 8 group levels. "clear" empties the map (all level 0).
const PRESETS: Record<string, { label: string; levels: Record<string, number> }> = {
  starting: {
    label: 'Just getting started',
    levels: {
      security_tooling_tamper_protection: 1,
      identity_and_privilege_hardening: 1,
      region_and_data_residency: 0,
      network_boundaries: 0,
      data_protection_and_encryption: 0,
      resource_tampering_protection: 0,
      backup_and_recovery_integrity: 0,
      identity_and_resource_perimeter: 0,
    },
  },
  foundation: {
    label: 'Solid foundation',
    levels: {
      security_tooling_tamper_protection: 2,
      identity_and_privilege_hardening: 2,
      data_protection_and_encryption: 2,
      region_and_data_residency: 1,
      network_boundaries: 1,
      resource_tampering_protection: 1,
      backup_and_recovery_integrity: 1,
      identity_and_resource_perimeter: 1,
    },
  },
  advanced: {
    label: 'Advanced / regulated',
    levels: {
      security_tooling_tamper_protection: 3,
      identity_and_privilege_hardening: 3,
      data_protection_and_encryption: 3,
      resource_tampering_protection: 3,
      backup_and_recovery_integrity: 3,
      identity_and_resource_perimeter: 3,
      network_boundaries: 2,
      region_and_data_residency: 2,
    },
  },
  clear: { label: 'Clear', levels: {} },
};

// Report palette — the Gap Report is a self-contained "document" with its own darker ink
// (#0e1230), distinct from the site --color-text. Content-signaling colors are literal hex;
// TEXT on tinted/white bg uses the darkened two-tone pair (grTextTone in the ref).
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

const SEV_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ff5470' },
  high: { label: 'High', color: '#f59f3c' },
  medium: { label: 'Medium', color: '#4d66e0' },
  low: { label: 'Low', color: '#8a8fa8' },
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function readJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) as T : fallback; } catch { return fallback; }
}
function writeJSON(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
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
function grSevBadge(sev: string): string {
  const m = SEV_META[sev] ?? SEV_META.low;
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:${m.color}14;flex-shrink:0"><span style="width:6px;height:6px;border-radius:999px;background:${m.color}"></span>${grMono(m.label, { size: 10, color: tone(m.color), ls: '0.1em', weight: 600 })}</span>`;
}
function grGroupPill(short: string): string {
  return `<span style="padding:2px 9px;border-radius:999px;border:1px solid ${GR.slate}33;flex-shrink:0">${grMono(short, { size: 9, color: GR.slate, ls: '0.08em', weight: 600 })}</span>`;
}
function lockMark(size = 24, color = GR.brand): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true" style="aspect-ratio:1/1"><rect x="3" y="5" width="20" height="16" rx="7" fill="none" stroke="${color}" stroke-width="3"></rect><rect x="10" y="11" width="6" height="4" rx="1.5" fill="${color}"></rect></svg>`;
}

// ---------- attack-section atoms (ported from report-sec3-playbooks.jsx) ----------
const mitreUrl = (t: string): string => `https://attack.mitre.org/techniques/${t.replace('.', '/')}/`;
function stateIcon(st: string, size = 16): string {
  if (st === 'no-control') return `<span style="width:${size}px;height:${size}px;border-radius:999px;background:#fff;border:1.5px dashed ${GR.slate}99;display:grid;place-content:center;flex-shrink:0;box-sizing:border-box" aria-label="No preventive control — scan/detect territory"><svg width="${size * 0.52}" height="${size * 0.52}" viewBox="0 0 12 12"><path d="M6 2.4 L10.1 9.7 H1.9 Z" fill="none" stroke="${GR.slate}" stroke-width="1.5" stroke-linejoin="round"></path></svg></span>`;
  if (st === 'open') return `<span style="width:${size}px;height:${size}px;border-radius:999px;background:#fff;border:2px solid ${GR.red};display:grid;place-content:center;flex-shrink:0;box-sizing:border-box" aria-label="Not yet enforced, by your estimate"><svg width="${size * 0.44}" height="${size * 0.44}" viewBox="0 0 11 11"><path d="M2 2 L9 9 M9 2 L2 9" stroke="${GR.red}" stroke-width="2.4" stroke-linecap="round"></path></svg></span>`;
  return `<span style="width:${size}px;height:${size}px;border-radius:999px;background:${GR.green};display:grid;place-content:center;flex-shrink:0;box-sizing:border-box" aria-label="Enforced guardrail, by your estimate"><svg width="${size * 0.56}" height="${size * 0.56}" viewBox="0 0 14 14"><path d="M3 7.4 L5.8 10 L11 4.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`;
}
function coverageLegend(): string {
  return `<div class="gr-legend">
    <span class="gr-leg-item">${stateIcon('closed', 14)} Enforced, by your estimate</span>
    <span class="gr-leg-item">${stateIcon('open', 14)} Not yet enforced</span>
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

// Calm, estimate-framed verdicts — never assert breach.
const VERDICT_COPY: Record<string, string> = {
  open: 'Early days, by your own estimate — a lot of ground still to cover. The upside: most of it is enforceable org-wide in a single pass.',
  foundation: 'A solid foundation, on this estimate. The controls that separate "good" from "hard to move through" are the ones worth verifying next.',
  strong: 'Strong posture, on this estimate. The last stretch is about proof — confirming each guardrail is actually enforced everywhere you think it is.',
};

export function initGuardrailsAssessment(root: HTMLElement, data: AssessData): () => void {
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const barTransition = prefersReduced ? '' : 'transition-[width] duration-500 ease-out';
  const catTotal = data.catalog.total;

  const state = {
    levels: readJSON<Record<string, number>>(LEVELS_KEY, {}),
    view: 'assess' as 'assess' | 'report',
    // §1/§2 interaction state
    selectedStage: null as string | null,
    expandedStories: new Set<string>(),
    collapsedActors: new Set<string>(
      (data.chains ?? []).filter(ch => !data.actors?.[ch.id]?.flagship).map(ch => ch.id),
    ),
    openPopover: null as string | null,
  };
  const persistLevels = () => writeJSON(LEVELS_KEY, state.levels);
  const levelOf = (key: string): number => state.levels[key] ?? 0;

  // ---------- assess view (rendered ONCE; targeted updates after) ----------
  const scoreboardHTML = () => {
    const cov = estimateCoverage(state.levels, data.catalog, data.phases);
    return `
      <div class="bg-white border border-black/5 rounded-2xl p-5 flex gap-5 items-center flex-wrap">
        ${ringSVG(cov.pct, 92, 9, covColor(cov.pct), 'ga-cov-fill', `
          <div class="text-center">
            <div class="text-[22px] font-extrabold text-[var(--color-text)] leading-none"><span id="ga-cov-pct">${Math.round(cov.pct * 100)}</span><span class="text-[12px] font-semibold">%</span></div>
            <span class="${MONO} tracking-[0.1em] text-[8.5px] text-slate-400">est. coverage</span>
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

  const leadHTML = `<p class="text-[14px] leading-relaxed text-slate-600 max-w-[680px]">Estimate how much of each guardrail group your org enforces today — this is a rough self-estimate. For a precise, control-by-control assessment of your actual AWS environment, <a href="/contact" class="text-[var(--color-brand)] font-semibold">talk to us</a>.</p>`;

  const presetsHTML = () => `
    <div class="grid gap-2.5">
      <span class="${MONO} tracking-[0.14em] text-[11px] text-slate-500">Start from a profile</span>
      <div class="flex flex-wrap gap-2">
        ${Object.entries(PRESETS).map(([key, p]) => `<button type="button" data-ga-preset="${key}" class="px-3.5 py-2 rounded-full border border-black/10 bg-white text-[12.5px] font-semibold text-slate-600 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition cursor-pointer">${esc(p.label)}</button>`).join('')}
      </div>
    </div>`;

  const segInner = (key: string): string => {
    const lvl = levelOf(key);
    return LEVEL_LABELS.map((lab, n) => {
      const on = lvl === n;
      return `<button type="button" data-ga-level="${key}:${n}" aria-pressed="${on}" class="px-3.5 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition ${on ? 'bg-[var(--color-text)] text-white shadow-sm' : 'text-slate-500 hover:text-[var(--color-text)]'}">${lab}</button>`;
    }).join('');
  };

  const slidersHTML = () => data.phases.map(p => `
    <section class="border border-black/5 rounded-2xl bg-white overflow-hidden">
      <div class="px-[18px] py-3 flex items-center gap-3 border-b border-[#f0f2fa]" style="background:${p.color}08">
        <span class="${MONO} tracking-[0.14em] text-[11px]" style="color:${p.color}">Phase 0${p.n}</span>
        <span class="font-bold text-[15px] text-[var(--color-text)]">${esc(p.name)}</span>
      </div>
      ${p.groups.map(key => {
        const g = data.groups[key];
        const count = data.catalog.groups[key]?.count ?? 0;
        return `
          <div class="border-b border-[#f0f2fa] last:border-b-0 px-[18px] py-3.5 grid gap-2.5">
            <div class="flex items-baseline gap-2.5 flex-wrap">
              <span class="font-semibold text-[14px] text-[var(--color-text)]">${esc(g ? g.label : key)}</span>
              <span class="${MONO} tracking-[0.1em] text-[10px] text-slate-400">${count} guardrails</span>
            </div>
            ${g ? `<p class="text-[12.5px] leading-relaxed text-slate-500 max-w-[560px]">${esc(g.blurb)}</p>` : ''}
            <div data-ga-seg="${key}" role="group" aria-label="${esc(g ? g.label : key)} coverage level" class="inline-flex flex-wrap gap-0.5 self-start rounded-full border border-black/10 bg-[#f8f9fe] p-0.5">${segInner(key)}</div>
          </div>`;
      }).join('')}
    </section>`).join('');

  const renderAssess = () => {
    root.innerHTML = `
      <div data-ga-assess class="grid gap-6">
        ${scoreboardHTML()}
        <div class="grid gap-3.5">
          ${leadHTML}
          ${presetsHTML()}
          ${slidersHTML()}
        </div>
      </div>
      <div data-ga-report hidden></div>`;
  };

  // ---------- targeted updates ----------
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const updateScore = () => {
    const cov = estimateCoverage(state.levels, data.catalog, data.phases);
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
  const updateSeg = (key: string) => {
    const seg = q<HTMLElement>(`[data-ga-seg="${key}"]`);
    if (seg) seg.innerHTML = segInner(key);
  };
  const updateAllSegs = () => {
    for (const key of Object.keys(data.groups)) updateSeg(key);
    updateScore();
  };

  // ---------- report view (estimate-driven arc + CTA) ----------
  const reportHTML = (): string => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cov = estimateCoverage(state.levels, data.catalog, data.phases);
    const pctInt = Math.round(cov.pct * 100);
    const tier = verdictTier(cov.pct);
    // The single source of truth every estimate-driven section consults, so §1, §2, table-stakes,
    // top-missing and AI all agree on what "covered" means.
    const covered = estimateCoveredIds(state.levels, data.representative);

    /* ===== estimate masthead (unnumbered) ===== */
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
          <span class="gr-stamp" style="padding:5px 12px;border-radius:6px;border:1.5px solid ${GR.amber};background:${GR.amber}0d">${grMono('Self-estimated', { size: 10.5, color: '#b26a0f', ls: '0.16em', weight: 600 })}</span>
        </div>
        <div style="display:grid;gap:10px">
          ${grMono(`Estimated posture snapshot · ${esc(dateLabel)}`, { size: 11.5, color: GR.brand, ls: '0.2em', weight: 600 })}
          <h1 style="margin:0;font-family:var(--font-serif);font-size:clamp(33px,5vw,42px);font-weight:600;letter-spacing:-0.02em;line-height:1.08;color:${GR.ink}">Guardrails Coverage Estimate</h1>
        </div>
        <div class="gr-verdict" style="display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;padding-top:6px">
          ${ringSVG(cov.pct, 132, 11, tierRing[tier], '', `<span style="font-family:var(--font-serif);font-size:38px;font-weight:600;color:${GR.ink};line-height:1">${pctInt}<span style="font-size:20px">%</span></span>${grMono('Estimate', { size: 9.5, color: GR.muted, ls: '0.14em' })}`)}
          <div style="display:grid;gap:10px">
            <p style="margin:0;font-family:var(--font-serif);font-size:20px;line-height:1.45;color:${GR.ink};text-wrap:pretty">${VERDICT_COPY[tier]}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${GR.body};text-wrap:pretty">This is your estimate — <strong style="color:${GR.ink}">${pctInt}%</strong> of InstaSecure's guardrails, weighted by severity, that you told us you enforce today. The number to trust is a precise scan of your actual environment.</p>
          </div>
        </div>
        <div style="display:grid;gap:12px;padding-top:4px">
          ${grMono('Estimated coverage by phase', { size: 10.5, color: GR.muted, ls: '0.16em', weight: 600 })}
          <div class="gr-phasechart" style="display:flex;gap:14px;align-items:flex-end">${phaseBars}</div>
        </div>
      </header>`;
    };

    /* ===== positioning strip — what "guardrail" means here (contrast vs IaC/CI-CD) ===== */
    const positioningNote = (): string => `<div style="display:grid;gap:7px;padding:16px 18px;border-radius:12px;border:1px solid ${GR.brand}24;background:${GR.brand}07">
      ${grMono('Control-plane guardrails', { size: 10, color: GR.brand, ls: '0.16em', weight: 600 })}
      <p style="margin:0;font-size:13px;line-height:1.6;color:${GR.body};text-wrap:pretty">InstaSecure enforces preventive guardrails at the AWS control plane — <strong style="color:${GR.ink}">SCPs, RCPs, and data-perimeter policies</strong> that execute at runtime, org-wide. Not an IaC or CI/CD policy check that runs before deploy and can be skipped; the cloud itself enforces these on every request.</p>
    </div>`;

    /* ===== §01 — attack-lifecycle coverage (estimate-projected) ===== */
    const renderLifecycle = (): string => {
      const rows = data.lifecycle;
      const mappedN = rows.filter(t => t.populated).length;

      // Wall scale — one rail per representative control shown at that stage. Representative
      // samples are small, so bricks stay discrete; the "+N" caption carries the catalog total.
      const maxCount = Math.max(1, ...rows.map(t => t.controls.length));
      const unit = Math.max(2, Math.min(13, Math.floor(53 / maxCount)));
      const roomy = unit >= 6;
      const railH = roomy ? unit - 3 : unit;
      const wallH = 23 + maxCount * unit;

      const axisCells = rows.map((row, i) => {
        const idx = String(i + 1).padStart(2, '0');
        if (!row.populated) {
          return `<div class="gr-lcp-cell is-tbd" title="${esc(row.tactic)} — no preventive guardrail (detection territory)">
            <span class="gr-lcp-wall"><span class="gr-lcp-rail is-ghost"></span></span>
            <span class="gr-lcp-nodestrip"><span class="gr-lcp-node is-tbd"></span></span>
            <span class="gr-lcp-meta"><span class="gr-lcp-idx">${idx}</span><span class="gr-lcp-tactic is-tbd">${esc(row.tactic)}</span></span>
          </div>`;
        }
        const shown = row.controls.length;
        const closedCount = row.controls.filter(c => covered.has(c.control)).length;
        const allClosed = closedCount === shown;
        const catCount = data.catalog.tactics[row.tactic] ?? shown;
        const more = Math.max(0, catCount - shown);
        const sel = state.selectedStage === row.tactic;
        // Rail is green where your estimate covers the control, red-outline where it isn't yet.
        // Open rails sort to the top of the wall (missing bricks).
        const rails = [...row.controls]
          .sort((a, b) => (covered.has(a.control) ? 1 : 0) - (covered.has(b.control) ? 1 : 0))
          .map(c => {
            const isCov = covered.has(c.control);
            return `<span class="gr-lcp-rail ${isCov ? 'is-closed' : 'is-open'}" style="--rail:${railH}px" title="${esc(c.control)} — ${esc(c.controlName)} (${isCov ? 'enforced, by your estimate' : 'not yet enforced, by your estimate'})"></span>`;
          })
          .join('');
        const ratio = `<span class="gr-lcp-ratio" style="color:${allClosed ? tone(GR.green) : tone(GR.red)}">${closedCount}/${shown}${more > 0 ? `<span style="color:${GR.faint};font-weight:500;font-size:9px"> +${more}</span>` : ''}</span>`;
        return `<button type="button" class="gr-lcp-cell${sel ? ' is-sel' : ''}" data-ga-stage="${esc(row.tactic)}" aria-pressed="${sel}" title="${esc(row.tactic)} — ${closedCount} of ${shown} covered on your estimate, ${catCount} in the full catalog">
          <span class="gr-lcp-wall${roomy ? '' : ' is-compact'}"${roomy ? '' : ' style="gap:0"'}>
            ${ratio}
            ${rails}
          </span>
          <span class="gr-lcp-nodestrip"><span class="gr-lcp-node"></span></span>
          <span class="gr-lcp-meta"><span class="gr-lcp-idx">${idx}</span><span class="gr-lcp-tactic">${esc(row.tactic)}</span></span>
        </button>`;
      }).join('');

      let detail = '';
      const selRow = rows.find(r => r.tactic === state.selectedStage && r.populated);
      if (selRow) {
        const shown = selRow.controls.length;
        const closedCount = selRow.controls.filter(c => covered.has(c.control)).length;
        const catCount = data.catalog.tactics[selRow.tactic] ?? shown;
        const more = Math.max(0, catCount - shown);
        const detailRows = selRow.controls.map(c => {
          const isCov = covered.has(c.control);
          const sc = data.storyMap[c.control] ?? null;
          const key = `lc:${selRow.tactic}:${c.control}`;
          const storyOpen = state.expandedStories.has(key);
          const ctlColor = isCov ? '#6d7290' : tone(GR.red);
          return `<div class="gr-vstep${isCov ? '' : ' is-open'}${sc ? ' has-story' : ''}"${sc ? ` data-ga-story="${esc(key)}" role="button" tabindex="0" aria-expanded="${storyOpen}"` : ''} title="${esc(c.technique)} · ${esc(selRow.tactic)} — ${isCov ? 'enforced, by your estimate' : 'not yet enforced, by your estimate'}">
            <span class="gr-vnode">${stateIcon(isCov ? 'closed' : 'open', 18)}</span>
            <div class="gr-vbody">
              <div class="gr-vrow1">
                <span class="gr-vlabel" style="color:${isCov ? GR.body : GR.ink};font-weight:${isCov ? 500 : 600}">${esc(c.controlName)}</span>
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
            ${grMono(`${closedCount}/${shown} covered${more > 0 ? ` · ${more} more in catalog` : ''}`, { size: 10, color: GR.faint, ls: '0.06em' })}
            <button type="button" class="gr-lc-close" aria-label="Close stage detail" data-ga-stage-close>×</button>
          </div>
          ${detailRows}
        </div>`;
      }

      const inner = `
        <div class="gr-b2-lead" style="display:grid;gap:9px">
          <p style="margin:0;font-family:var(--font-serif);font-size:18.5px;line-height:1.5;color:${GR.ink};text-wrap:pretty">Based on your estimate, here's where the kill chain is covered — and where it's still open.</p>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">Every InstaSecure guardrail maps to MITRE ATT&amp;CK. This is a representative sample across the kill chain — a rail for each control we name, green where your estimate says it's enforced, red where it's not yet. The full catalog covers far more at each stage: InstaSecure's ${catTotal} control-plane guardrails reach every MITRE ATT&amp;CK (cloud) technique a guardrail can close, then go further into AWS-native data-perimeter controls the vendor-neutral matrix has no technique ID for.</p>
          ${coverageLegend()}
        </div>
        <div style="display:grid;gap:9px">
          <p style="margin:0;font-size:12.5px;line-height:1.55;color:${GR.muted};text-wrap:pretty">The attack path, in MITRE tactic order — every campaign moves left to right through these stages. Each stage raises a wall of the guardrails that break attacks there: green where your estimate covers them, red where it doesn't yet; “+N” is how many more the catalog enforces.<span class="gr-hint-screen"> Select a stage to see its controls.</span></p>
          <div class="gr-lcp" style="--gr-wall-h:${wallH}px;--gr-axis-y:${wallH + 15}px">${axisCells}</div>
          ${detail}
          <p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">${mappedN} of ${rows.length} stages carry preventive controls in the ATT&amp;CK v19.1 catalog — stages without one are detection territory. Representative sample — ${data.representative.length} guardrails named here; InstaSecure enforces ${catTotal} in total.</p>
        </div>`;
      return grSection('01', 'Attack-lifecycle coverage', '', inner, 'gr-attack');
    };

    /* ===== §02 — real-adversary playbooks (estimate-projected) ===== */
    const vStep = (s: PlaybookStep, i: number, actorId: string): string => {
      const nc = s.control === null;
      const isCov = !nc && covered.has(s.control!);
      const open = !nc && !isCov;
      const st = nc ? 'no-control' : isCov ? 'closed' : 'open';
      const sc = s.control ? data.storyMap[s.control] ?? null : null;
      const key = `pb:${actorId}:${i}`;
      const storyOpen = state.expandedStories.has(key);
      const labelColor = nc ? GR.slateDark : open ? GR.ink : GR.body;
      const ctlColor = nc ? GR.slate : open ? tone(GR.red) : '#6d7290';
      const techColor = nc ? GR.slate : open ? tone(GR.red) : '#6d7290';
      const ctlText = nc ? '△ scan / detect' : esc(s.control!) + (s.partial ? ' · partial' : '');
      const title = `${s.techniqueName} · ${s.tactic}\n${s.api}\n${nc ? 'No preventive guardrail — detection / scan territory.' : (isCov ? 'Enforced by ' : 'Not yet enforced, by your estimate — ') + (s.controlName ?? '') + (s.sev ? ` (${s.sev})` : '') + (s.partial ? ' — partial coverage' : '')}`;
      return `<div class="gr-vstep${open ? ' is-open' : nc ? ' is-nc' : ''}${sc ? ' has-story' : ''}"${sc ? ` data-ga-story="${esc(key)}" role="button" tabindex="0" aria-expanded="${storyOpen}"` : ''} title="${esc(title)}">
        <span class="gr-vnode">${stateIcon(st, 18)}</span>
        <div class="gr-vbody">
          <div class="gr-vrow1">
            <span class="gr-vlabel" style="color:${labelColor};font-weight:${open ? 700 : 500}">${esc(s.label)}</span>
            ${sc ? storyCaret(storyOpen) : ''}
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
      const cards = data.chains.map(ch => {
        const actor = data.actors[ch.id];
        if (!actor) return '';
        const collapsed = state.collapsedActors.has(ch.id);
        const openState = !collapsed;
        const cite = [actor.mitreGroup ? `MITRE ${actor.mitreGroup}` : 'No MITRE group designation', ...actor.sources.map(s => `${s.name} (${s.date})`)].join(' · ');
        const spark = collapsed ? `<span class="gr-spark" aria-hidden="true">${ch.steps.map(s => stateIcon(s.control === null ? 'no-control' : covered.has(s.control) ? 'closed' : 'open', 12)).join('')}</span>` : '';
        const preventive = ch.steps.filter(s => s.control !== null).length;
        const closedSteps = ch.steps.filter(s => s.control !== null && covered.has(s.control)).length;
        const openSteps = preventive - closedSteps;
        const detection = ch.steps.filter(s => s.control === null).length;
        const covPill = openSteps === 0
          ? `<span style="padding:3px 11px;border-radius:999px;background:${GR.green}14">${grMono(`${closedSteps}/${preventive} guardrails hold`, { size: 9.5, color: tone(GR.green), ls: '0.1em', weight: 600 })}</span>`
          : `<span style="padding:3px 11px;border-radius:999px;background:${GR.red}14">${grMono(`${openSteps} of ${preventive} open`, { size: 9.5, color: tone(GR.red), ls: '0.1em', weight: 600 })}</span>`;
        const ncPill = detection > 0 ? `<span style="padding:3px 11px;border-radius:999px;border:1px solid ${GR.slate}33">${grMono(`△ ${detection} detection-only`, { size: 9.5, color: GR.slate, ls: '0.1em', weight: 600 })}</span>` : '';
        const pop = state.openPopover === ch.id ? infoPop(actor) : '';
        const tacticsCount = new Set(ch.steps.map(s => s.tactic)).size;
        let prevTactic: string | null = null;
        const stepRows = ch.steps.map((s, i) => {
          let out = '';
          if (s.tactic !== prevTactic) { out += `<div class="gr-tactic-mini">${esc(s.tactic)}</div>`; prevTactic = s.tactic; }
          out += vStep(s, i, ch.id);
          return out;
        }).join('');
        const meta = `${ch.steps.length} documented moves · ${tacticsCount}${actor.flagship ? ` of ${data.lifecycle.length}` : ''} tactics`;
        return `<div class="gr-actor" data-open="${openState}">
          <div class="gr-actor-hrow">
            <button type="button" class="gr-actor-toggle" data-ga-actor="${esc(ch.id)}" aria-expanded="${openState}">
              <svg class="gr-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 L7.5 5 L3 8.5" stroke="#8a8fa8" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              <span class="gr-actor-name">${esc(actor.name)}</span>
            </button>
            <span class="gr-info">
              <button type="button" class="gr-info-btn" data-ga-popover="${esc(ch.id)}" aria-expanded="${state.openPopover === ch.id}" aria-label="${esc(actor.name)} — aliases, MITRE group, sources">i</button>
              ${pop}
            </span>
            <span class="gr-actor-meta">${esc(meta)}</span>
            <span style="margin-left:auto;display:inline-flex;gap:7px;align-items:center;flex-shrink:0">${spark}${covPill}${ncPill}</span>
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
          <p style="margin:0;font-family:var(--font-serif);font-size:18.5px;line-height:1.5;color:${GR.ink};text-wrap:pretty">How named adversaries move — and where InstaSecure breaks the chain.</p>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">Documented cloud campaigns from published threat research, walked step by step. Every move is cited; each preventive step names the InstaSecure control-plane guardrail that stops it — green where your estimate says it's enforced, red where it's not yet. Steps with a dotted label expand to the scenario behind them.</p>
        </div>
        <div style="display:grid;gap:10px">${cards}</div>
        <p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">Technique IDs link to the MITRE ATT&amp;CK® Enterprise (IaaS) matrix; actor attributions are dated, cited claims. △ marks moves with no preventive control — detection / scan territory. Open = not yet enforced, by your estimate.</p>`;
      return grSection('02', 'Real-adversary playbooks', '', inner, 'gr-attack');
    };

    /* ===== §03 — table stakes (mandatory floor, representative sample) ===== */
    const tableStakes = (): string => {
      const mand = data.representative.filter(c => c.tier === 'mandatory');
      const allCov = mand.length > 0 && mand.every(c => covered.has(c.id));
      const footnote = `<p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">Representative sample — InstaSecure enforces ${data.catalog.mandatoryTotal} mandatory “table-stakes” controls org-wide. <a href="/contact" style="color:${GR.brand};font-weight:600;text-decoration:none">See them all: talk to us</a>.</p>`;
      if (allCov) {
        return grSection('03', 'Table stakes', '', `${grAllClear('On your estimate, the mandatory floor is covered — verify it with a scan.')}${footnote}`);
      }
      const rows = mand.map(c => {
        const isCov = covered.has(c.id);
        const g = data.groups[c.group];
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:#fff;border:1px solid ${GR.border}">
          <span style="flex-shrink:0">${stateIcon(isCov ? 'closed' : 'open', 18)}</span>
          <span style="width:94px;flex-shrink:0;display:inline-flex">${grSevBadge(c.sev)}</span>
          <span style="flex:1;min-width:0;font-size:13.5px;font-weight:500;color:${GR.ink};line-height:1.45">${esc(c.name)}</span>
          ${g ? grGroupPill(esc(g.short)) : ''}
        </div>`;
      }).join('');
      const inner = `
        <div style="display:grid;gap:6px">
          <p style="margin:0;font-family:var(--font-serif);font-size:18.5px;line-height:1.5;color:${GR.ink};text-wrap:pretty">Before framework mapping, settle the floor.</p>
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">Mandatory = InstaSecure's own day-one baseline, not a regulatory claim. Here's a representative sample of that floor; the icon shows where your estimate already covers it and where it's not yet enforced.</p>
        </div>
        <div style="display:grid;gap:7px">${rows}</div>
        ${footnote}`;
      return grSection('03', 'Table stakes', '', inner);
    };

    /* ===== §04 — compliance evidence (public frameworks, estimate coverage) ===== */
    const compliance = (): string => {
      const pct = cov.pct;
      const pctLabel = `${Math.round(pct * 100)}%`;
      const gridCols = 'grid-template-columns:130px 92px 1fr';
      const headerRow = `<div class="gr-fw-row" style="display:grid;${gridCols};gap:14px;align-items:center">
        ${grMono('Framework', { size: 9.5, color: GR.faint, ls: '0.12em', weight: 600 })}
        ${grMono('Controls map', { size: 9.5, color: GR.faint, ls: '0.12em', weight: 600 })}
        <span style="text-align:right">${grMono('Estimated evidence coverage', { size: 9.5, color: GR.faint, ls: '0.12em', weight: 600 })}</span>
      </div>`;
      const rows = data.frameworks.map(f => {
        const n = data.catalog.frameworks[f.key] ?? 0;
        return `<div class="gr-fw-row" style="display:grid;${gridCols};gap:14px;align-items:center">
          ${grMono(esc(f.label), { size: 11, color: GR.ink, ls: '0.05em', weight: 600 })}
          <span style="font-size:13.5px;color:${GR.body};font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap">${n}<span style="color:${GR.muted};font-weight:500"> map</span></span>
          <div style="display:flex;align-items:center;gap:9px">
            <div style="flex:1;height:9px;border-radius:999px;background:${GR.track};overflow:hidden" role="img" aria-label="${pctLabel} estimated evidence coverage for ${esc(f.label)}">
              <div style="width:${pct * 100}%;height:100%;background:${covColor(pct)}"></div>
            </div>
            <span style="font-family:var(--font-mono);font-size:10px;color:${GR.muted};width:34px;text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums">${pctLabel}</span>
          </div>
        </div>`;
      }).join('');
      const tamperCallout = `<div class="gr-b2-callout" style="display:grid;gap:8px;padding:16px 18px;border-radius:12px;border:1px solid ${GR.purple}14;background:${GR.purple}08">
        ${grMono('Evidence integrity', { size: 10.5, color: tone(GR.purple), ls: '0.16em', weight: 600 })}
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.ink};text-wrap:pretty">InstaSecure enforces <strong>${data.catalog.auditTamperTotal}</strong> controls tagged audit-tampering — the ones that keep logs admissible if someone tries to silence them. A precise scan confirms these are enforced before your audit.</p>
      </div>`;
      const inner = `
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">Each guardrail maps to the public standards below. The count is how many InstaSecure control-plane guardrails provide preventive evidence for that framework; the bar applies your overall coverage estimate across them — a precise assessment resolves it per framework.</p>
        <div style="display:grid;gap:9px">${headerRow}${rows}</div>
        <p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">Frameworks are public standards; InstaSecure guardrails provide preventive evidence for each. Coverage shown is your estimate — a precise assessment maps your enforced controls per framework. <a href="/contact" style="color:${GR.brand};font-weight:600;text-decoration:none">Talk to us</a>.</p>
        ${tamperCallout}`;
      return grSection('04', 'Compliance evidence', '', inner);
    };

    /* ===== §05 — top missing controls (representative higher-severity gaps) ===== */
    const topMissingSec = (): string => {
      const sevRank: Record<string, number> = { critical: 0, high: 1 };
      const missing = data.representative
        .filter(c => !covered.has(c.id) && (c.sev === 'critical' || c.sev === 'high'))
        .sort((a, b) => (sevRank[a.sev] ?? 9) - (sevRank[b.sev] ?? 9))
        .slice(0, 6);
      if (missing.length === 0) {
        return grSection('05', 'Top missing controls', '', grAllClear('On your estimate, no critical or high-severity gaps remain in this sample. Verify it — a scan confirms enforcement across every account, OU, and region.'));
      }
      const rows = missing.map(c => {
        const g = data.groups[c.group];
        return `<div class="gr-missing-row" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:#fff;border:1px solid ${GR.border}">
          <span style="width:94px;flex-shrink:0;display:inline-flex">${grSevBadge(c.sev)}</span>
          <span style="flex:1;min-width:0;font-size:13.5px;font-weight:500;color:${GR.ink};line-height:1.45">${esc(c.name)}</span>
          ${g ? grGroupPill(esc(g.short)) : ''}
        </div>`;
      }).join('');
      const inner = `
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.body};text-wrap:pretty">On your estimate, these higher-severity guardrails aren't yet enforced. This is a representative sample — a precise scan ranks your real gaps in priority order.</p>
        <div style="display:grid;gap:7px">${rows}</div>
        <p style="margin:0;font-size:11.5px;line-height:1.55;color:${GR.muted}">Representative sample of higher-severity gaps on your estimate — InstaSecure's full catalog has more. A precise scan ranks your real gaps. <a href="/contact" style="color:${GR.brand};font-weight:600;text-decoration:none">Talk to us</a>.</p>`;
      return grSection('05', 'Top missing controls', '', inner);
    };

    /* ===== §06 — AI guardrails (representative sample, verbatim board copy) ===== */
    const aiSection = (): string => {
      const aiControls = data.representative.filter(c => c.id.startsWith('IS-BEDROCK'));
      const rows = aiControls.map(c => {
        const isCov = covered.has(c.id);
        return `<div style="display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;background:#fff;border:1px solid ${GR.purple}1f">
          <span style="flex-shrink:0">${stateIcon(isCov ? 'closed' : 'open', 16)}</span>
          <span style="width:78px;flex-shrink:0;display:inline-flex">${grSevBadge(c.sev)}</span>
          <span style="flex:1;min-width:0;font-size:12.5px;font-weight:500;color:${GR.ink};line-height:1.45">${esc(c.name)}</span>
        </div>`;
      }).join('');
      const inner = `<div style="display:grid;gap:12px;padding:18px 20px;border-radius:12px;border:1px solid ${GR.purple}14;background:${GR.purple}08">
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:${GR.ink};text-wrap:pretty">InstaSecure enforces <strong>${data.catalog.aiTotal}</strong> AI guardrails (sample below; the AI guardrail catalog is expanding). Your genAI adoption may be ahead of your genAI governance — that's a board question this quarter.</p>
        <div style="display:grid;gap:6px">${rows}</div>
      </div>`;
      return grSection('06', 'AI guardrails', '', inner);
    };

    /* ===== §07 — from estimate to enforcement (close + Save as PDF) ===== */
    const closeSection = (): string => {
      const fwList = data.frameworks.slice(0, 4).map(f => f.label).join(', ');
      const inner = `<div class="gr-close-panel" style="display:grid;gap:20px;padding:28px 30px;border-radius:16px;background:${GR.ink};color:#fff">
        <div style="display:grid;gap:12px">
          <p style="margin:0;font-family:var(--font-serif);font-size:19px;line-height:1.5;color:#fff;text-wrap:pretty">This is a rough estimate. A precise assessment is a scan.</p>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#ffffffd9;text-wrap:pretty">A scan maps all <strong style="color:#fff">${catTotal}</strong> InstaSecure control-plane guardrails to your actual AWS organization — the specific gaps, the framework evidence you're missing (${esc(fwList)}), and the order to close them. It covers the <strong style="color:#fff">${data.catalog.auditTamperTotal}</strong> audit-integrity controls that keep your logs admissible, too. Every guardrail ships as an SCP, RCP, or VPC endpoint policy — enforced at the control plane, not a pre-deploy check.</p>
        </div>
        <div class="gr-cta-row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch">
          <a href="/contact" class="gr-cta-primary" style="display:grid;gap:2px;padding:12px 22px;border-radius:11px;background:${GR.brand};color:#fff;text-decoration:none;box-shadow:0 10px 24px -10px #4d66e099">
            <span style="font-size:14.5px;font-weight:700">Verify with a real scan</span>
            <span style="font-size:11.5px;color:#ffffffb3">See your actual number — not the estimate</span>
          </a>
          <button type="button" id="ga-print" class="gr-cta-secondary" style="padding:12px 22px;border-radius:11px;background:transparent;border:1px solid #ffffff3d;color:#fff;font-family:var(--font-sans);font-size:14px;font-weight:600;cursor:pointer">Save as PDF</button>
        </div>
      </div>
      <div style="display:grid;gap:5px;padding-top:2px">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${GR.muted}">Every control above ships as an enforced, org-wide guardrail — an SCP, RCP, or data-perimeter policy. Zero code.</p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${GR.muted}">This report reflects what you estimated. An estimate ≠ enforcement — a real scan verifies every control across every account, OU, and region.</p>
      </div>`;
      return grSection('07', 'From estimate to enforcement', '', inner, 'gr-close');
    };

    const printHeader = `<div class="gr-print-header">
      <div style="display:flex;align-items:center;gap:9px">${lockMark(20)}<span style="font-family:var(--font-sans);font-size:13.5px;font-weight:700;color:${GR.ink}">InstaSecure</span><span style="font-family:var(--font-sans);font-size:13.5px;font-weight:400;color:${GR.muted}">— Guardrails Coverage Estimate</span></div>
      <div style="display:grid;gap:2px;justify-items:end">${grMono(esc(dateLabel), { size: 10, color: GR.body, ls: '0.08em' })}<span style="font-family:var(--font-mono);font-size:10px;color:${GR.faint};letter-spacing:0.06em">instasecure.ai/learn/guardrails-assessment</span></div>
    </div>`;
    const backBtn = `<div class="gr-backlink" style="padding-bottom:16px"><button id="ga-back" type="button" style="font-family:var(--font-mono);font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:${GR.body};background:none;border:0;cursor:pointer;padding:0">← Back to estimate</button></div>`;

    return `<div style="max-width:920px;margin:0 auto">
      ${printHeader}
      ${backBtn}
      <article class="gr-sheet" aria-label="Guardrails Coverage Estimate">
        ${masthead()}
        ${positioningNote()}
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

  const toggleSet = (set: Set<string>, key: string) => { if (set.has(key)) set.delete(key); else set.add(key); };

  // ---------- event delegation (bound once) ----------
  const onClick = (e: Event) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    // org-profile preset — sets all group levels at once
    const preset = t.closest<HTMLElement>('[data-ga-preset]');
    if (preset) {
      const p = PRESETS[preset.dataset.gaPreset ?? ''];
      if (p) { state.levels = { ...p.levels }; persistLevels(); updateAllSegs(); }
      return;
    }
    // per-group segmented level (key:n)
    const seg = t.closest<HTMLElement>('[data-ga-level]');
    if (seg) {
      const [key, nStr] = (seg.dataset.gaLevel ?? '').split(':');
      const n = Number(nStr);
      if (key && Number.isFinite(n) && n >= 0 && n <= 3) {
        state.levels[key] = n; persistLevels(); updateSeg(key); updateScore();
      }
      return;
    }
    if (t.closest('#ga-open-report')) { showView('report'); return; }
    if (t.closest('#ga-back')) { showView('assess'); return; }
    if (t.closest('#ga-reset')) { state.levels = {}; persistLevels(); updateAllSegs(); return; }
    if (t.closest('#ga-print')) { window.print(); return; }
    // report links (technique / source / CTA) navigate natively
    if (t.closest('a[href]')) return;
    // §1/§2 interactions
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
  root.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousedown', onDocPointerDown);
  document.addEventListener('keydown', onDocKey);
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);
  renderAssess();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousedown', onDocPointerDown);
    document.removeEventListener('keydown', onDocKey);
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
    document.body.classList.remove('is-print');
  };
}
