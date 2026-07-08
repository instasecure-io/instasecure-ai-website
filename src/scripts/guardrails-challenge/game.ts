// Pure game logic for the Guardrails Challenge (run-based arcade).
// No DOM, no localStorage, no Date/Math.random — seeds/timestamps/severities are passed in,
// so every function is deterministic and unit-testable. Ported from the framework-free
// challenge2-model.js handoff; the private control catalog is NEVER imported here.

export type Sev = 'critical' | 'high' | 'medium' | 'low';

export interface BoardEntry { name: string; score: number; when: string }

export interface PlayScenario {
  id: string; threat: string; title: string; scenario: string; explain: string;
  correct: string; options: string[];
}

// A scenario placed in a run: kill-chain tactic, per-gate timer, zero-day flag.
export interface RunScenario extends PlayScenario {
  tMax: number; zd: boolean; tactic: string;
}

export interface LogRow { q: RunScenario; ok: boolean; tLeft: number; timedOut: boolean; gained: number }

// Kill-chain ordering: every scenario sits at a stage of one coherent intrusion.
// A run samples scenarios, then sorts by this order — the campaign escalates from
// initial access to impact, so the last gates are always the climax.
export const C2_STAGE: Record<string, { ord: number; tactic: string }> = {
  'sc-imds-lambda-url': { ord: 1, tactic: 'Initial Access' },
  'sc-stolen-key':      { ord: 2, tactic: 'Initial Access' },
  'sc-bedrock-key':     { ord: 3, tactic: 'Credential Access' },
  'sc-federation':      { ord: 4, tactic: 'Persistence' },
  'sc-root':            { ord: 5, tactic: 'Privilege Escalation' },
  'sc-privesc':         { ord: 6, tactic: 'Privilege Escalation' },
  'sc-cloudtrail':      { ord: 7, tactic: 'Defense Evasion' },
  'sc-guardduty':       { ord: 8, tactic: 'Defense Evasion' },
  'sc-org-leave':       { ord: 9, tactic: 'Defense Evasion' },
  'sc-public-snapshot': { ord: 10, tactic: 'Exfiltration' },
  'sc-ram-share':       { ord: 11, tactic: 'Exfiltration' },
  'sc-presigned':       { ord: 12, tactic: 'Exfiltration' },
  'sc-exfil-s3':        { ord: 13, tactic: 'Exfiltration' },
  'sc-region':          { ord: 14, tactic: 'Impact' },
  'sc-ransom-backup':   { ord: 15, tactic: 'Impact' },
  'sc-kms-lockout':     { ord: 16, tactic: 'Impact' },
};

export function c2Tactic(id: string): string {
  return (C2_STAGE[id] ?? { tactic: 'Intrusion' }).tactic;
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface RunOpts { stages: number; baseTimer: number; zeroDay: boolean }

// Build one run: sample -> kill-chain order -> per-stage timers -> zero-day placement.
// Per-gate timer max(8, base - gateIndex): pressure rises as the attacker goes deeper.
export function buildRun(scenarios: PlayScenario[], seed: number, opts: RunOpts): RunScenario[] {
  const { stages, baseTimer, zeroDay } = opts;
  const picked = seededShuffle(scenarios, seed).slice(0, stages)
    .sort((a, b) => (C2_STAGE[a.id]?.ord ?? 99) - (C2_STAGE[b.id]?.ord ?? 99));
  const zdIndex = zeroDay && stages >= 5
    ? Math.min(stages - 2, Math.floor(stages * 0.55) + (seed % 3)) : -1;
  return picked.map((s, i) => {
    const zd = i === zdIndex;
    const tMax = zd ? Math.max(6, Math.round(baseTimer * 0.45)) : Math.max(8, baseTimer - i);
    return { ...s, options: seededShuffle(s.options, seed + i * 7), tMax, zd, tactic: c2Tactic(s.id) };
  });
}

// Streak multiplier tiers, applied to the whole round's points (streak read BEFORE the answer).
export function c2Multiplier(streak: number): number {
  if (streak >= 6) return 2;
  if (streak >= 4) return 1.5;
  if (streak >= 2) return 1.25;
  return 1;
}

export type PointPart = [string, number | null];

// Points for a correct answer. severity/timer/streak/zero-day all compound.
export function c2Points(o: { sev: Sev; tMax: number; tLeft: number; timerOn: boolean; streak: number; zd: boolean }): { total: number; parts: PointPart[] } {
  const sevBonus = ({ critical: 50, high: 30, medium: 15, low: 0 } as Record<Sev, number>)[o.sev] ?? 0;
  const speed = o.timerOn ? Math.round((o.tLeft / o.tMax) * 50) : 25;
  const baseMult = c2Multiplier(o.streak);
  const mult = baseMult * (o.zd ? 2 : 1);
  const raw = (100 + sevBonus + speed) * mult;
  const total = Math.round(raw / 5) * 5;
  const parts: PointPart[] = [['base', 100]];
  if (sevBonus) parts.push([o.sev === 'critical' ? 'critical save' : `${o.sev} save`, sevBonus]);
  if (speed) parts.push(['speed', speed]);
  if (baseMult > 1) parts.push([`streak ×${baseMult}`, null]);
  if (o.zd) parts.push(['zero-day ×2', null]);
  return { total, parts };
}

// Realistic ceiling for the rank ratio (per gate ~ (100+50+50) * zdMult * 1.6).
export function c2MaxScore(run: RunScenario[]): number {
  return run.reduce((s, q) => s + Math.round(((100 + 50 + 50) * (q.zd ? 2 : 1) * 1.6) / 5) * 5, 0);
}

export function c2Rank(score: number, run: RunScenario[]): { title: string; note: string } {
  const r = score / Math.max(1, c2MaxScore(run));
  if (r >= 0.62) return { title: 'Perimeter Architect', note: 'You could teach this. The wall holds.' };
  if (r >= 0.45) return { title: 'Guardrail Engineer', note: 'Strong instincts — a few doors still ajar.' };
  if (r >= 0.28) return { title: 'Cloud Defender', note: 'Solid fundamentals. The advanced patterns bite.' };
  return { title: 'Detection Believer', note: 'You watch attacks happen. Prevention is a mindset shift.' };
}

// Badges — identity rewards tied to real expertise, all computed from the run log.
export interface BadgeMeta {
  completed: boolean; breaches: number; breachLimit: number;
  bestStreak: number; timerOn: boolean; log: LogRow[];
}
export interface Badge { id: string; label: string; test: (m: BadgeMeta) => boolean }

export const C2_BADGES: Badge[] = [
  { id: 'flawless', label: 'Flawless Defense', test: m => m.completed && m.breaches === 0 },
  { id: 'clutch', label: 'Clutch Deny', test: m => m.timerOn && m.log.some(r => r.ok && r.tLeft <= 2) },
  { id: 'chain', label: 'Chain ×6', test: m => m.bestStreak >= 6 },
  { id: 'zeroday', label: 'Zero-Day Hunter', test: m => m.log.some(r => r.ok && r.q.zd) },
  { id: 'perimeter', label: 'Perimeter Purist', test: m => { const p = m.log.filter(r => r.q.correct.indexOf('IS-PERIMETER') === 0); return p.length >= 2 && p.every(r => r.ok); } },
  { id: 'comeback', label: 'Comeback', test: m => m.completed && m.breachLimit >= 2 && m.breaches === m.breachLimit - 1 },
];

export function c2EarnedBadges(m: BadgeMeta): Badge[] { return C2_BADGES.filter(b => b.test(m)); }

export const SEEDED_BOARD: BoardEntry[] = [
  { name: 'perimeter_paul', score: 1980, when: 'seed' },
  { name: 'scp_or_die', score: 1760, when: 'seed' },
  { name: 'denyall_dana', score: 1445, when: 'seed' },
  { name: 'ctrl_tower_tina', score: 1120, when: 'seed' },
  { name: 'least_priv_lee', score: 860, when: 'seed' },
];

// Share text — plain, paste-ready for Slack/LinkedIn.
export function c2ShareText(o: { score: number; rank: { title: string }; held: number; total: number; contained: boolean; handle: string }): string {
  const who = o.handle ? o.handle + ' — ' : '';
  const outcome = o.contained ? 'breach contained' : 'breached at gate ' + (o.held + 1);
  return who + o.score + ' pts · ' + o.rank.title + ' · ' + o.held + '/' + o.total +
    ' gates held (' + outcome + ') on the InstaSecure Guardrails Challenge. ' +
    'Think you can hold the wall? instasecure.ai/learn/guardrails-challenge';
}

export function mergeBoard(board: BoardEntry[], entry: BoardEntry): BoardEntry[] {
  return [...board.filter(b => !(b.name === entry.name && b.when !== 'seed' && b.score <= entry.score)), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
