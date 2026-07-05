// Pure assessment logic — no DOM, no localStorage, no Date.now (now is injected).
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
