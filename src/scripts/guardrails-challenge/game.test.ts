import { describe, it, expect } from 'vitest';
import {
  seededShuffle, c2Tactic, buildRun, c2Multiplier, c2Points, c2MaxScore, c2Rank,
  c2EarnedBadges, c2ShareText, mergeBoard, SEEDED_BOARD,
  type PlayScenario, type RunScenario, type LogRow,
} from './game';

// A minimal scenario factory keyed on real C2_STAGE ids so the kill-chain sort is meaningful.
const sc = (id: string, correct = 'IS-X-1'): PlayScenario => ({
  id, threat: 'policy-bypass', title: 'T', scenario: 'x', explain: 'y', correct,
  options: [correct, 'IS-A-1', 'IS-B-1', 'IS-C-1'],
});
const ALL_IDS = [
  'sc-imds-lambda-url', 'sc-stolen-key', 'sc-bedrock-key', 'sc-federation', 'sc-root',
  'sc-privesc', 'sc-cloudtrail', 'sc-guardduty', 'sc-org-leave', 'sc-public-snapshot',
  'sc-ram-share', 'sc-presigned', 'sc-exfil-s3', 'sc-region', 'sc-ransom-backup', 'sc-kms-lockout',
];
const ALL = ALL_IDS.map(id => sc(id));

const runScenario = (over: Partial<RunScenario> = {}): RunScenario => ({
  id: 'sc-root', threat: 'policy-bypass', title: 'T', scenario: 'x', explain: 'y',
  correct: 'IS-IAM-PV-5', options: ['IS-IAM-PV-5'], tMax: 20, zd: false, tactic: 'Impact', ...over,
});
const logRow = (over: Partial<LogRow> = {}): LogRow => ({
  q: runScenario(over.q), ok: true, tLeft: 10, timedOut: false, gained: 150, ...over,
});

describe('seededShuffle', () => {
  it('is deterministic for a given seed', () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 42)).toEqual(seededShuffle([1, 2, 3, 4, 5], 42));
  });
  it('returns a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = seededShuffle(input, 7);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('c2Tactic', () => {
  it('maps a known scenario to its kill-chain tactic', () => {
    expect(c2Tactic('sc-root')).toBe('Privilege Escalation');
    expect(c2Tactic('sc-kms-lockout')).toBe('Impact');
  });
  it('falls back to Intrusion for an unknown id', () => {
    expect(c2Tactic('sc-nope')).toBe('Intrusion');
  });
});

describe('buildRun', () => {
  it('samples exactly `stages` scenarios', () => {
    expect(buildRun(ALL, 123, { stages: 10, baseTimer: 20, zeroDay: true })).toHaveLength(10);
  });

  it('sorts the run by kill-chain order (escalates to impact)', () => {
    const run = buildRun(ALL, 999, { stages: 10, baseTimer: 20, zeroDay: false });
    // ALL_IDS is authored in kill-chain order, so its index == the C2_STAGE rank.
    const ords = run.map(q => ALL_IDS.indexOf(q.id));
    for (let i = 1; i < ords.length; i++) expect(ords[i]).toBeGreaterThan(ords[i - 1]);
  });

  it('places exactly one zero-day gate at the seed-derived index with halved timer and no other zd', () => {
    const run = buildRun(ALL, 0, { stages: 10, baseTimer: 20, zeroDay: true });
    // zdIndex = min(stages-2, floor(stages*0.55) + seed%3) = min(8, 5+0) = 5
    const zdIdx = run.findIndex(q => q.zd);
    expect(zdIdx).toBe(5);
    expect(run.filter(q => q.zd)).toHaveLength(1);
    expect(run[5].tMax).toBe(9); // max(6, round(20*0.45)) = 9
  });

  it('gives non-zero-day gates a timer that shrinks with depth: max(8, base - i)', () => {
    const run = buildRun(ALL, 0, { stages: 10, baseTimer: 20, zeroDay: false });
    run.forEach((q, i) => expect(q.tMax).toBe(Math.max(8, 20 - i)));
  });

  it('skips the zero-day gate when disabled or when fewer than 5 stages', () => {
    expect(buildRun(ALL, 0, { stages: 10, baseTimer: 20, zeroDay: false }).some(q => q.zd)).toBe(false);
    expect(buildRun(ALL, 0, { stages: 3, baseTimer: 20, zeroDay: true }).some(q => q.zd)).toBe(false);
  });

  it('shuffles each option set but preserves membership', () => {
    const run = buildRun(ALL, 5, { stages: 4, baseTimer: 20, zeroDay: false });
    run.forEach(q => {
      const src = ALL.find(s => s.id === q.id)!;
      expect([...q.options].sort()).toEqual([...src.options].sort());
    });
  });
});

describe('c2Multiplier', () => {
  it('steps ×1 → ×1.25 → ×1.5 → ×2 on the pre-answer streak', () => {
    expect([0, 1].map(c2Multiplier)).toEqual([1, 1]);
    expect([2, 3].map(c2Multiplier)).toEqual([1.25, 1.25]);
    expect([4, 5].map(c2Multiplier)).toEqual([1.5, 1.5]);
    expect([6, 9].map(c2Multiplier)).toEqual([2, 2]);
  });
});

describe('c2Points', () => {
  it('base + critical save + full speed at no streak = 200', () => {
    const r = c2Points({ sev: 'critical', tMax: 20, tLeft: 20, timerOn: true, streak: 0, zd: false });
    expect(r.total).toBe(200);
    expect(r.parts).toEqual([['base', 100], ['critical save', 50], ['speed', 50]]);
  });

  it('applies the streak multiplier to the whole round and labels it', () => {
    const r = c2Points({ sev: 'critical', tMax: 20, tLeft: 20, timerOn: true, streak: 2, zd: false });
    expect(r.total).toBe(250); // 200 * 1.25
    expect(r.parts).toContainEqual(['streak ×1.25', null]);
  });

  it('zero-day doubles on top of the streak multiplier', () => {
    const r = c2Points({ sev: 'high', tMax: 20, tLeft: 20, timerOn: true, streak: 6, zd: true });
    expect(r.total).toBe(720); // (100+30+50) * 2 * 2
    expect(r.parts).toContainEqual(['zero-day ×2', null]);
  });

  it('uses a flat speed bonus of 25 when the timer is off', () => {
    const r = c2Points({ sev: 'medium', tMax: 20, tLeft: 0, timerOn: false, streak: 0, zd: false });
    expect(r.total).toBe(140); // 100 + 15 + 25
    expect(r.parts).toEqual([['base', 100], ['medium save', 15], ['speed', 25]]);
  });

  it('rounds the total to the nearest 5 and omits a zero-severity save', () => {
    const r = c2Points({ sev: 'low', tMax: 20, tLeft: 7, timerOn: true, streak: 0, zd: false });
    // speed = round(7/20*50)=18; raw=118 -> round(118/5)*5 = 120
    expect(r.total).toBe(120);
    expect(r.parts).toEqual([['base', 100], ['speed', 18]]);
  });
});

describe('c2MaxScore / c2Rank', () => {
  const oneGate = [runScenario({ zd: false })];
  it('c2MaxScore uses the realistic per-gate ceiling', () => {
    expect(c2MaxScore(oneGate)).toBe(320); // round((200)*1.6/5)*5
    expect(c2MaxScore([runScenario({ zd: true })])).toBe(640);
  });
  it('ranks on the score/max ratio at 0.62 / 0.45 / 0.28', () => {
    expect(c2Rank(199, oneGate).title).toBe('Perimeter Architect'); // 199/320 = 0.622
    expect(c2Rank(198, oneGate).title).toBe('Guardrail Engineer');   // 0.619
    expect(c2Rank(143, oneGate).title).toBe('Cloud Defender');       // 0.447
    expect(c2Rank(89, oneGate).title).toBe('Detection Believer');    // 0.278
  });
});

describe('c2EarnedBadges', () => {
  it('awards flawless + chain + zero-day + perimeter for a clean perfect run', () => {
    const log: LogRow[] = [
      logRow({ q: runScenario({ correct: 'IS-PERIMETER-PV-9' }), ok: true }),
      logRow({ q: runScenario({ correct: 'IS-PERIMETER-PV-16' }), ok: true }),
      logRow({ q: runScenario({ zd: true }), ok: true, tLeft: 1 }),
    ];
    const earned = c2EarnedBadges({ completed: true, breaches: 0, breachLimit: 3, bestStreak: 6, timerOn: true, log })
      .map(b => b.id);
    expect(earned).toEqual(expect.arrayContaining(['flawless', 'chain', 'zeroday', 'perimeter', 'clutch']));
  });

  it('withholds perimeter purist when a perimeter gate was missed', () => {
    const log: LogRow[] = [
      logRow({ q: runScenario({ correct: 'IS-PERIMETER-PV-9' }), ok: true }),
      logRow({ q: runScenario({ correct: 'IS-PERIMETER-PV-16' }), ok: false }),
    ];
    const earned = c2EarnedBadges({ completed: false, breaches: 3, breachLimit: 3, bestStreak: 1, timerOn: true, log })
      .map(b => b.id);
    expect(earned).not.toContain('perimeter');
    expect(earned).not.toContain('flawless');
  });

  it('awards comeback when the run finishes one breach short of the limit', () => {
    const earned = c2EarnedBadges({ completed: true, breaches: 2, breachLimit: 3, bestStreak: 2, timerOn: true, log: [] })
      .map(b => b.id);
    expect(earned).toContain('comeback');
  });
});

describe('c2ShareText', () => {
  it('renders a paste-ready line with outcome and handle', () => {
    const text = c2ShareText({ score: 1500, rank: { title: 'Guardrail Engineer' }, held: 8, total: 10, contained: true, handle: 'dana' });
    expect(text).toContain('dana — 1500 pts · Guardrail Engineer · 8/10 gates held (breach contained)');
    expect(text).toContain('instasecure.ai/learn/guardrails-challenge');
  });
  it('reports the gate where the wall fell when not contained', () => {
    const text = c2ShareText({ score: 300, rank: { title: 'Cloud Defender' }, held: 3, total: 10, contained: false, handle: '' });
    expect(text).toContain('breached at gate 4');
  });
});

describe('mergeBoard', () => {
  it('inserts, sorts descending, caps at 10', () => {
    const out = mergeBoard(SEEDED_BOARD, { name: 'me', score: 2500, when: '2026-07-08' });
    expect(out[0]).toEqual({ name: 'me', score: 2500, when: '2026-07-08' });
    expect(out.length).toBeLessThanOrEqual(10);
  });
  it('never drops a seeded entry even on a name collision', () => {
    const board = [{ name: 'me', score: 100, when: 'seed' }];
    expect(mergeBoard(board, { name: 'me', score: 200, when: '2026-07-08' })).toHaveLength(2);
  });
  it('replaces a prior non-seed entry of the same name with a higher score', () => {
    const board = [{ name: 'me', score: 100, when: '2026-07-01' }];
    const out = mergeBoard(board, { name: 'me', score: 200, when: '2026-07-08' });
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(200);
  });
});
