import {
  coverage, openThreatWeights, topMissing, scenarioReplay, killChain,
  mandatoryGaps, frameworkGaps, verdictTier, daysUntilMonth, auditTamperGaps,
  orgScopeGapCount,
  type AssessControl, type PhaseRef, type ScenarioLite, type FrameworkRef,
} from './assess';

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
function sevBadge(sev: string): string {
  const m = SEV_META[sev] ?? SEV_META.low;
  return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] flex-none" style="color:${m.color};background:${m.color}14"><span class="w-1.5 h-1.5 rounded-full" style="background:${m.color}"></span>${m.label}</span>`;
}
function implBadge(impl: string): string {
  return `<span class="font-mono text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-[#f0f2fa] text-slate-500 flex-none">${IMPL_META[impl] ?? impl}</span>`;
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

  // ---------- report view ----------
  const reportHTML = (): string => {
    const now = new Date();
    const nowIso = now.toISOString();
    const dateLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const cov = coverage(state.have, data.controls, data.phases);
    const pctInt = Math.round(cov.pct * 100);
    const tier = verdictTier(cov.pct);
    const replay = scenarioReplay(state.have, data.scenarios);
    const chain = killChain(state.have);
    const openLinks = chain.filter(s => !s.blocked).length;
    const tamper = auditTamperGaps(state.have, data.auditTamperIds, data.controls);
    const mand = mandatoryGaps(state.have, data.controls);
    const fwGaps = frameworkGaps(state.have, data.controls, data.frameworks);
    const worstFw = [...fwGaps].sort((a, b) => b.missing - a.missing)[0];
    const threats = openThreatWeights(state.have, data.controls);
    const missing = topMissing(state.have, data.controls);
    const orgGaps = orgScopeGapCount(state.have, data.controls);
    const aiHave = data.aiControlIds.filter(id => state.have.has(id)).length;
    const aiTotal = data.aiControlIds.length;
    const days = state.audit ? daysUntilMonth(nowIso, state.audit) : null;

    const card = (inner: string) => `<div class="bg-white border border-black/5 rounded-2xl p-6 grid gap-3 ga-avoid-break">${inner}</div>`;
    const monoHead = (t: string) => `<span class="${MONO} tracking-[0.14em] text-[11px] text-slate-400">${t}</span>`;

    const b1 = card(`
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="m-0 text-[21px] font-extrabold text-[var(--color-text)]">Guardrails Gap Report</h2>
        <span class="${MONO} tracking-[0.14em] text-[10.5px] text-slate-400">Self-attested posture snapshot · ${dateLabel}</span>
      </div>
      <div class="flex gap-4 items-center flex-wrap">
        ${ringSVG(cov.pct, 64, 7, covColor(cov.pct), '', `<span class="font-extrabold text-[15px] text-[var(--color-text)]">${pctInt}%</span>`)}
        <p class="m-0 flex-1 min-w-[240px] text-[14px] leading-relaxed text-slate-600">${VERDICT_COPY[tier]}</p>
      </div>
      <p class="m-0 text-[13px] leading-relaxed text-[var(--color-text)] font-medium">Your self-attested coverage is ${pctInt}%. The number to trust is the scan-verified one: which guardrails are technically enforced, and where coverage still needs evidence.</p>
      <div class="grid gap-1.5">
        ${cov.perPhase.map(p => `
          <div class="flex items-center gap-2.5">
            <span class="${MONO} text-[9.5px] w-5 flex-none" style="color:${p.color}">0${p.n}</span>
            <span class="text-[11.5px] font-semibold text-slate-600 w-[170px] flex-none">${esc(p.name)}</span>
            <div class="flex-1 h-[6px] rounded-full bg-[#eef1fb] overflow-hidden"><div class="h-full rounded-full" style="width:${p.pct * 100}%;background:${p.color}"></div></div>
            <span class="${MONO} text-[9.5px] text-slate-400 w-[30px] text-right flex-none">${Math.round(p.pct * 100)}%</span>
          </div>`).join('')}
      </div>`);

    const scenarioRows = replay.failing.map(s => {
      const t = data.threats[s.threat] ?? { label: s.threat, color: '#64748b' };
      const ctrl = controlsById.get(s.correct);
      return `<div class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#f8f9fe] ga-avoid-break flex-wrap">
        <span class="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full flex-none" style="color:${t.color};background:${t.color}14">${esc(t.label)}</span>
        <span class="text-[13px] font-semibold text-[var(--color-text)]">${esc(s.title)}</span>
        <span class="text-[12px] text-slate-500">open because: ${esc(ctrl ? ctrl.name : s.correct)}</span>
      </div>`;
    }).join('');
    const b2 = card(`
      <h3 class="m-0 text-[16px] font-bold text-[var(--color-text)]">${replay.failing.length === 0 ? `All ${replay.total} scenario checks closed — now verify it with a scan.` : `${replay.failing.length} of ${replay.total} scenario checks are open in your self-attestation.`}</h3>
      <p class="m-0 text-[13px] text-slate-600">Each one names the missing preventive control; a scan verifies whether that deny is actually enforced.</p>
      ${scenarioRows ? `<div class="grid gap-1.5">${scenarioRows}</div>` : ''}
      <div class="grid gap-2 pt-1">
        ${monoHead('Modeled ransomware kill chain')}
        <div class="flex gap-1.5 flex-wrap">
          ${chain.map(s => `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-semibold ga-avoid-break" style="${s.blocked ? 'border-color:#22b07d44;background:#22b07d0d;color:#1d6f52' : 'border-color:#ff547044;background:#ff54700d;color:#c2273f'}">
              ${s.blocked ? '✓' : '✗'} ${esc(s.label)}${s.blocked ? '' : ' — OPEN'}
            </span>`).join('')}
        </div>
        <p class="m-0 text-[12.5px] text-slate-600">${openLinks === 0 ? 'Chain severed at every link. This is what preventive coverage looks like.' : `${openLinks}/5 modeled ransomware-chain guardrails are open: audit logging, detection, privilege escalation, backup deletion, and key control. A scan should confirm whether those denies are enforced across the assessed AWS environment.`}</p>
      </div>
      ${tamper.missing > 0 ? `
        <div class="rounded-xl border px-4 py-3 ga-avoid-break" style="border-color:#b95ad844;background:#b95ad80d">
          <p class="m-0 text-[13px] leading-relaxed text-[var(--color-text)]">You did not attest enforcement for <strong>${tamper.missing}/${tamper.total}</strong> controls tagged audit-tampering, including <strong>${tamper.missingCritical}</strong> critical controls. Treat those as priority evidence-integrity checks before the audit.</p>
        </div>` : ''}`);

    const b3 = card(`
      <h3 class="m-0 text-[16px] font-bold text-[var(--color-text)]">${mand.length === 0 ? `All ${mandatoryTotal} mandatory controls attested. That's the floor — the blocks below are the walls.` : `Before framework mapping, settle the floor: ${mand.length}/${mandatoryTotal} of InstaSecure's day-one critical baseline are not attested as enforced.`}</h3>
      ${mand.length ? `<div class="grid gap-1.5">${mand.map(c => `<div class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#f8f9fe] ga-avoid-break">${sevBadge(c.sev)}<span class="text-[13px] text-[var(--color-text)]">${esc(c.name)}</span></div>`).join('')}</div>` : ''}
      <p class="m-0 text-[12.5px] text-slate-500">Mandatory = InstaSecure's own day-one baseline — not a regulatory claim. All ${mandatoryTotal} are critical severity; there is no compensating-control story for these.</p>`);

    const b4 = card(`
      <h3 class="m-0 text-[16px] font-bold text-[var(--color-text)]">Compliance evidence queue</h3>
      <p class="m-0 text-[13px] text-slate-600">This is not a framework pass/fail score. It is the evidence queue: mapped preventive controls you did not attest as technically enforced. Auditors sample technical enforcement, not policy PDFs.</p>
      <div class="grid gap-1.5">
        ${fwGaps.map(f => `
          <div class="flex items-center gap-2.5 ga-avoid-break">
            <span class="text-[12.5px] font-semibold text-slate-600 w-[110px] flex-none">${esc(f.label)}</span>
            <div class="flex-1 h-[7px] rounded-full bg-[#f0f2fa] overflow-hidden"><div class="h-full rounded-full bg-[var(--color-brand)]" style="width:${f.total ? (f.missing / f.total) * 100 : 0}%"></div></div>
            <span class="${MONO} text-[10px] text-slate-400 w-[46px] text-right flex-none">${f.missing}/${f.total}</span>
          </div>`).join('')}
      </div>
      <div class="ga-screen-chrome flex items-center gap-2.5 flex-wrap pt-1">
        <label for="ga-audit" class="text-[12.5px] text-slate-500">When is your next audit? — optional</label>
        <input id="ga-audit" type="month" value="${esc(state.audit)}" class="border border-black/10 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--color-text)]">
      </div>
      ${state.audit && days !== null && worstFw ? `
        <p class="m-0 text-[13px] font-medium text-[var(--color-text)]">${days >= 0
          ? `${worstFw.missing} ${esc(worstFw.label)} mapped controls are not attested as enforced. If your audit window starts in ${esc(fmtMonth(state.audit))}, use the remaining ${days} days to triage the largest evidence queue first.`
          : 'Your last audit window has passed — the next one is closer than it feels.'}</p>` : ''}`);

    const maxT = threats.length ? threats[0][1] : 0;
    const b5 = card(`
      ${monoHead('Unchecked preventive weight by threat')}
      ${threats.length === 0
        ? `<p class="m-0 text-[13px] text-slate-600">No unchecked preventive weight left in any threat category — now verify it with a scan.</p>`
        : `<div class="grid gap-1.5">
            ${threats.map(([key, w]) => {
              const t = data.threats[key] ?? { label: key, color: '#64748b' };
              return `<div class="flex items-center gap-2.5 ga-avoid-break">
                <span class="text-[12.5px] font-semibold text-slate-600 w-[180px] flex-none">${esc(t.label)}</span>
                <div class="flex-1 h-[8px] rounded-full bg-[#f0f2fa] overflow-hidden"><div class="h-full rounded-full" style="width:${(w / maxT) * 100}%;background:${t.color}"></div></div>
              </div>`;
            }).join('')}
          </div>
          <p class="m-0 text-[12.5px] text-slate-600">Your unchecked control weight is concentrated in ${esc((data.threats[threats[0][0]] ?? { label: threats[0][0] }).label)}. That does not predict an incident; it tells the scan where preventive coverage is thinnest.</p>`}`);

    const shown = missing.slice(0, 20);
    const b6 = card(`
      <p class="m-0 text-[13px] leading-relaxed text-[var(--color-text)] font-medium">${orgGaps} of your open gaps are org-scope controls. Your self-attested score says what you believe is deployed; a scan should verify whether org-level guardrails are enforced across the intended AWS Organization coverage.</p>
      ${monoHead(`Top missing controls (${missing.length})`)}
      <div class="grid gap-1.5">
        ${shown.map((c, i) => `
          <div class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#f8f9fe] ga-avoid-break ${i >= 8 ? 'hidden print:flex' : ''}">
            ${sevBadge(c.sev)}<span class="text-[13px] text-[var(--color-text)] flex-1">${esc(c.name)}</span>${implBadge(c.impl)}
          </div>`).join('')}
      </div>
      ${missing.length > 8 ? `<span class="text-[12px] text-slate-400 print:hidden">…and ${missing.length - 8} more.</span>` : ''}
      ${missing.length > 20 ? `<span class="text-[12px] text-slate-400 hidden print:inline">…and ${missing.length - 20} more.</span>` : ''}`);

    const b7 = aiHave < aiTotal ? card(`
      <p class="m-0 text-[13px] leading-relaxed text-[var(--color-text)]"><strong>${aiHave}/${aiTotal}</strong> AI guardrails enforced. Your genAI adoption may be ahead of your genAI governance — that's a board question this quarter.</p>`) : '';

    const gate = state.gateOpen ? `
      <form id="ga-gate-form" class="ga-screen-chrome flex gap-2 items-center justify-center flex-wrap">
        <label for="ga-gate-email" class="sr-only">Email address</label>
        <input id="ga-gate-email" type="email" required placeholder="you@company.com" value="${esc(state.emailDraft)}"
          class="border border-black/10 rounded-lg px-3.5 py-2.5 text-[14px] w-[260px] outline-none focus:border-[var(--color-brand)]">
        <button type="submit" ${state.gateBusy ? 'disabled' : ''} class="px-5 py-2.5 rounded-full bg-[var(--color-brand)] text-white font-bold text-[13.5px] cursor-pointer ${state.gateBusy ? 'opacity-60' : 'hover:opacity-90'} transition">Send my report</button>
        ${state.gateError ? `<span class="text-[12.5px] font-semibold" style="color:#ff5470">Couldn't send — try again</span>` : ''}
      </form>` : '';

    const b8 = card(`
      <p class="m-0 text-[14px] leading-relaxed text-[var(--color-text)] font-medium">Every gap listed here maps to an SCP, RCP, or VPC endpoint policy. The scan turns the report into an artifact checklist: which policy controls are present, missing, or not enforced.</p>
      <div class="ga-screen-chrome flex gap-3 justify-center flex-wrap items-center pt-1">
        <a href="/contact" class="inline-flex flex-col items-center gap-0.5 bg-[var(--color-brand)] text-white no-underline rounded-full px-7 py-3 shadow-md shadow-[var(--color-brand)]/25 font-bold text-[15px] hover:opacity-90 transition">
          <span>Verify with a real scan</span>
          <span class="text-[11.5px] font-medium opacity-85">See your actual number — not the attested one</span>
        </a>
        <button id="ga-export" class="px-6 py-3 rounded-full border border-black/10 bg-white font-bold text-[14px] text-[var(--color-text)] hover:bg-slate-50 transition cursor-pointer">Email me this report (PDF)</button>
      </div>
      ${gate}
      <div class="grid gap-1 text-center">
        <span class="text-[11.5px] text-slate-400">Every control above ships as an enforced, org-wide guardrail. Zero code.</span>
        <span class="text-[11.5px] text-slate-400">This report reflects what you attested. Attestation ≠ enforcement — a real scan verifies every control across every account, OU, and region.</span>
      </div>`);

    return `
      <div class="grid gap-4">
        <div class="ga-print-header hidden print:flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true" style="aspect-ratio:1/1"><rect x="3" y="5" width="20" height="16" rx="7" fill="none" stroke="#4d66e0" stroke-width="3"></rect><rect x="10" y="11" width="6" height="4" rx="1.5" fill="#4d66e0"></rect></svg>
          <span class="font-bold text-[14px] text-[var(--color-text)]">InstaSecure — Guardrails Gap Report</span>
          <span class="text-[11px] text-slate-400 ml-auto">${dateLabel} · instasecure.ai/learn/guardrails-assessment</span>
        </div>
        <button id="ga-back" class="ga-screen-chrome justify-self-start px-4 py-2 rounded-full border border-black/10 bg-white font-semibold text-[13px] text-[var(--color-text)] hover:bg-slate-50 transition cursor-pointer">← Back to checklist</button>
        ${b1}${b2}${b3}${b4}${b5}${b6}${b7}${b8}
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
    if (t.closest('#ga-export')) { doExport(); return; }
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

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  renderAssess();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('submit', onSubmit);
  };
}
