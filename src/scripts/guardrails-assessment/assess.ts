// Pure assessment logic — no DOM, no localStorage, no Date.now (now is injected).
import type { PlaybookStep, LifecycleTactic } from '@/data/guardrails/attack-chains';

export const SEV_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export interface AssessControl {
  id: string; name: string;
  sev: 'critical' | 'high' | 'medium' | 'low';
  tier: 'mandatory' | 'strongly_recommended' | 'elective';
  impl: 'scp' | 'rcp' | 'vpc_endpoint_policy';
  group: string; scope: string;
  threats: string[]; fw: string[];
}
export interface PhaseRef { n: number; name: string; color: string; groups: string[] }
export interface ScenarioLite { id: string; title: string; threat: string; correct: string }
export interface FrameworkRef { key: string; label: string }

export function coverage(have: ReadonlySet<string>, controls: AssessControl[], phases: PhaseRef[]) {
  let got = 0, total = 0;
  const perPhase = phases.map(p => {
    const groupSet = new Set(p.groups);
    let pGot = 0, pTotal = 0;
    for (const c of controls) {
      if (!groupSet.has(c.group)) continue;
      const w = SEV_WEIGHT[c.sev] ?? 1;
      pTotal += w;
      if (have.has(c.id)) pGot += w;
    }
    got += pGot; total += pTotal;
    return { n: p.n, name: p.name, color: p.color, pct: pTotal ? pGot / pTotal : 0 };
  });
  return { pct: total ? got / total : 0, perPhase };
}

// ---------- ESTIMATE model (public: per-group coverage level, no per-control catalog) ----------
// The public assessment ships only the catalog *summary* (per-group severity weight + counts),
// never the 122-control array. The user picks a coverage LEVEL per group (None/Some/Most/All);
// each level maps to a fraction of that group's weight. This is a rough self-estimate, not an
// attestation — the precise number comes from a real scan.
export const LEVEL_FRAC = [0, 0.34, 0.67, 1] as const;

export interface CatalogGroupRef { count: number; weight: number; mandatory: number }
export interface CatalogRef {
  total: number;
  groups: Record<string, CatalogGroupRef>;
  phaseWeight: Record<string, number>;
  tactics: Record<string, number>;
  aiTotal: number;
  auditTamperTotal: number;
}

export interface EstimatePhase { n: number; name: string; color: string; pct: number }

export function estimateCoverage(
  levels: Record<string, number>,
  catalog: { groups: Record<string, { weight: number }> },
  phases: PhaseRef[],
): { pct: number; perPhase: EstimatePhase[] } {
  const frac = (key: string): number => LEVEL_FRAC[levels[key] ?? 0] ?? 0;
  // overall = Σ_groups(weight × frac[level]) / Σ_groups(weight); a missing group ⇒ level 0.
  let got = 0, total = 0;
  for (const [key, g] of Object.entries(catalog.groups)) {
    const w = g.weight ?? 0;
    total += w;
    got += w * frac(key);
  }
  const perPhase: EstimatePhase[] = phases.map(p => {
    let pGot = 0, pTotal = 0;
    for (const key of p.groups) {
      const w = catalog.groups[key]?.weight ?? 0;
      pTotal += w;
      pGot += w * frac(key);
    }
    return { n: p.n, name: p.name, color: p.color, pct: pTotal ? pGot / pTotal : 0 };
  });
  return { pct: total ? got / total : 0, perPhase };
}

export function openThreatWeights(have: ReadonlySet<string>, controls: AssessControl[]): Array<[string, number]> {
  const agg: Record<string, number> = {};
  for (const c of controls) {
    if (have.has(c.id)) continue;
    const w = SEV_WEIGHT[c.sev] ?? 1;
    for (const t of c.threats) agg[t] = (agg[t] ?? 0) + w;
  }
  return Object.entries(agg).sort((a, b) => b[1] - a[1]);
}

export function topMissing(have: ReadonlySet<string>, controls: AssessControl[]): AssessControl[] {
  return controls
    .filter(c => !have.has(c.id) && (c.sev === 'critical' || (c.sev === 'high' && c.tier !== 'elective')))
    .sort((a, b) => (SEV_WEIGHT[b.sev] ?? 1) - (SEV_WEIGHT[a.sev] ?? 1));
}

export function scenarioReplay(have: ReadonlySet<string>, scenarios: ScenarioLite[]) {
  const failing = scenarios.filter(s => !have.has(s.correct));
  return { failing, total: scenarios.length };
}

export const KILL_CHAIN: Array<{ id: string; label: string }> = [
  { id: 'IS-CT-PV-1', label: 'Silence the audit log' },
  { id: 'IS-GUARDDUTY-PV-1', label: 'Blind threat detection' },
  { id: 'IS-IAM-PV-10', label: 'Escalate privileges' },
  { id: 'IS-BACKUP-PV-5', label: 'Destroy the backups' },
  { id: 'IS-KMS-PV-8', label: 'Lock the keys' },
];

export function killChain(have: ReadonlySet<string>) {
  return KILL_CHAIN.map(s => ({ ...s, blocked: have.has(s.id) }));
}

export function mandatoryGaps(have: ReadonlySet<string>, controls: AssessControl[]): AssessControl[] {
  return controls.filter(c => c.tier === 'mandatory' && !have.has(c.id));
}

export function frameworkGaps(have: ReadonlySet<string>, controls: AssessControl[], curated: FrameworkRef[]) {
  return curated.map(f => {
    const mapped = controls.filter(c => c.fw.includes(f.key));
    const missing = mapped.filter(c => !have.has(c.id)).length;
    return { key: f.key, label: f.label, total: mapped.length, have: mapped.length - missing, missing };
  });
}

export function verdictTier(pct: number): 'open' | 'foundation' | 'strong' {
  if (pct < 0.4) return 'open';
  if (pct < 0.75) return 'foundation';
  return 'strong';
}

export function daysUntilMonth(nowIso: string, ym: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) return null;
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(year, month - 1, 1);
  return Math.round((target - nowUtc) / 86400000);
}

export function auditTamperGaps(have: ReadonlySet<string>, auditTamperIds: string[], controls: AssessControl[]) {
  const byId = new Map(controls.map(c => [c.id, c]));
  let missing = 0, missingCritical = 0;
  for (const id of auditTamperIds) {
    if (have.has(id)) continue;
    missing++;
    if (byId.get(id)?.sev === 'critical') missingCritical++;
  }
  return { missing, missingCritical, total: auditTamperIds.length };
}

export function orgScopeGapCount(have: ReadonlySet<string>, controls: AssessControl[]): number {
  return controls.filter(c => c.scope === 'org' && !have.has(c.id)).length;
}

// ---------- attack sections (§2 lifecycle + §3 playbooks) ----------
export type AttackState = 'closed' | 'open' | 'no-control';

export function stepState(have: ReadonlySet<string>, control: string | null): AttackState {
  if (control === null) return 'no-control';
  return have.has(control) ? 'closed' : 'open';
}

export interface LifecycleCell {
  tactic: string;
  populated: boolean;
  total: number;
  closed: number;
  controls: { control: string; controlName: string; technique: string; state: 'closed' | 'open' }[];
}

export function lifecycleView(have: ReadonlySet<string>, lifecycle: LifecycleTactic[]): LifecycleCell[] {
  return lifecycle.map(t => {
    const controls = t.controls.map(c => ({
      ...c,
      state: (have.has(c.control) ? 'closed' : 'open') as 'closed' | 'open',
    }));
    return {
      tactic: t.tactic,
      populated: t.populated,
      total: controls.length,
      closed: controls.filter(c => c.state === 'closed').length,
      controls,
    };
  });
}

export interface PlaybookNode extends PlaybookStep {
  state: AttackState;
  scenario: { title: string; explain: string } | null;
}
export interface PlaybookView {
  id: string;
  steps: PlaybookNode[];
  openLinks: number;
  detectionOnly: number;
  tacticsCount: number;
}

export function playbookView(
  have: ReadonlySet<string>,
  chains: { id: string; steps: PlaybookStep[] }[],
  storyMap: Record<string, { title: string; explain: string }>,
): PlaybookView[] {
  return chains.map(ch => {
    const steps: PlaybookNode[] = ch.steps.map(s => ({
      ...s,
      state: stepState(have, s.control),
      scenario: s.control ? storyMap[s.control] ?? null : null,
    }));
    return {
      id: ch.id,
      steps,
      openLinks: steps.filter(s => s.state === 'open').length,
      detectionOnly: steps.filter(s => s.state === 'no-control').length,
      tacticsCount: new Set(ch.steps.map(s => s.tactic)).size,
    };
  });
}

export interface AttackCompleteness {
  techniques: number;
  openTechniques: number;
  openTactics: number;
  detectionOnly: number;
}

export function attackCompleteness(
  have: ReadonlySet<string>,
  chains: { id: string; steps: PlaybookStep[] }[],
  lifecycle: LifecycleTactic[],
): AttackCompleteness {
  const techniques = new Set<string>();
  const openTechniques = new Set<string>();
  const openTactics = new Set<string>();
  const consider = (technique: string, tactic: string, control: string | null) => {
    techniques.add(technique);
    if (control !== null && !have.has(control)) {
      openTechniques.add(technique);
      openTactics.add(tactic);
    }
  };
  for (const t of lifecycle) for (const c of t.controls) consider(c.technique, t.tactic, c.control);
  let detectionOnly = 0;
  for (const ch of chains)
    for (const s of ch.steps) {
      consider(s.technique, s.tactic, s.control);
      if (s.control === null) detectionOnly++;
    }
  return {
    techniques: techniques.size,
    openTechniques: openTechniques.size,
    openTactics: openTactics.size,
    detectionOnly,
  };
}

export function sharedOpenGaps(
  have: ReadonlySet<string>,
  chains: { id: string; steps: PlaybookStep[] }[],
): Record<string, number> {
  const perControl: Record<string, Set<string>> = {};
  for (const ch of chains) {
    for (const s of ch.steps) {
      if (s.control && !have.has(s.control)) {
        (perControl[s.control] ??= new Set<string>()).add(ch.id);
      }
    }
  }
  const out: Record<string, number> = {};
  for (const [ctrl, set] of Object.entries(perControl)) if (set.size >= 2) out[ctrl] = set.size;
  return out;
}
