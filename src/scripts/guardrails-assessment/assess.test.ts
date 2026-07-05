import { describe, it, expect } from 'vitest';
import {
  SEV_WEIGHT, coverage, openThreatWeights, topMissing, scenarioReplay,
  KILL_CHAIN, killChain, mandatoryGaps, frameworkGaps, verdictTier,
  daysUntilMonth, auditTamperGaps, orgScopeGapCount, type AssessControl,
} from './assess';
import { CONTROLS } from '@/data/guardrails/controls';

const C = (o: Partial<AssessControl> & { id: string }): AssessControl => ({
  name: o.id, sev: 'medium', tier: 'elective', impl: 'scp', group: 'g1', scope: 'org',
  threats: [], fw: [], ...o,
}) as AssessControl;

// weights: a=4 (critical), b=3 (high), c=2 (medium) → total 9; g1 total 7, g2 total 2
const FIX: AssessControl[] = [
  C({ id: 'a', sev: 'critical', tier: 'mandatory', group: 'g1', scope: 'org', threats: ['t1'], fw: ['F1'] }),
  C({ id: 'b', sev: 'high', tier: 'strongly_recommended', group: 'g1', scope: 'account', threats: ['t1', 't2'], fw: ['F1', 'F2'] }),
  C({ id: 'c', sev: 'medium', tier: 'elective', group: 'g2', scope: 'org', threats: ['t2'], fw: [] }),
];
const PH = [
  { n: 1, name: 'P1', color: '#111111', groups: ['g1'] },
  { n: 2, name: 'P2', color: '#222222', groups: ['g2'] },
];
const S = (ids: string[]) => new Set(ids);

describe('coverage', () => {
  it('empty set scores 0 overall and per phase', () => {
    const r = coverage(S([]), FIX, PH);
    expect(r.pct).toBe(0);
    expect(r.perPhase.map(p => p.pct)).toEqual([0, 0]);
  });
  it('full set scores 1', () => {
    expect(coverage(S(['a', 'b', 'c']), FIX, PH).pct).toBe(1);
  });
  it('is severity-weighted overall and per phase', () => {
    const r = coverage(S(['a']), FIX, PH);
    expect(r.pct).toBeCloseTo(4 / 9, 10);
    expect(r.perPhase[0].pct).toBeCloseTo(4 / 7, 10);
    expect(r.perPhase[1].pct).toBe(0);
  });
});

describe('verdictTier', () => {
  it('boundaries at 0.4 and 0.75', () => {
    expect(verdictTier(0.39)).toBe('open');
    expect(verdictTier(0.4)).toBe('foundation');
    expect(verdictTier(0.749)).toBe('foundation');
    expect(verdictTier(0.75)).toBe('strong');
  });
});

describe('openThreatWeights', () => {
  it('aggregates unchecked weight per threat, sorted desc', () => {
    expect(openThreatWeights(S([]), FIX)).toEqual([['t1', 7], ['t2', 5]]);
  });
  it('is empty when everything is attested', () => {
    expect(openThreatWeights(S(['a', 'b', 'c']), FIX)).toEqual([]);
  });
});

describe('topMissing', () => {
  it('includes critical and non-elective high; excludes medium and elective high; sorts by weight', () => {
    const withElectiveHigh = [...FIX, C({ id: 'd', sev: 'high', tier: 'elective', group: 'g1' })];
    const r = topMissing(S([]), withElectiveHigh);
    expect(r.map(c => c.id)).toEqual(['a', 'b']);
  });
});

describe('scenarioReplay', () => {
  const scen = [
    { id: 's1', title: 'One', threat: 't1', correct: 'a' },
    { id: 's2', title: 'Two', threat: 't2', correct: 'c' },
  ];
  it('a scenario check is open iff its control is unchecked', () => {
    const r = scenarioReplay(S(['a']), scen);
    expect(r.total).toBe(2);
    expect(r.failing.map(s => s.id)).toEqual(['s2']);
  });
});

describe('killChain', () => {
  it('has 5 fixed steps and maps blocked from the set', () => {
    expect(KILL_CHAIN).toHaveLength(5);
    const r = killChain(S([KILL_CHAIN[0].id, KILL_CHAIN[3].id]));
    expect(r.map(s => s.blocked)).toEqual([true, false, false, true, false]);
  });
  it('KILL_CHAIN ids exist in the real catalog', () => {
    const ids = new Set(CONTROLS.map(c => c.id));
    for (const s of KILL_CHAIN) expect(ids.has(s.id), s.id).toBe(true);
  });
});

describe('mandatoryGaps', () => {
  it('returns unchecked mandatory controls only', () => {
    expect(mandatoryGaps(S([]), FIX).map(c => c.id)).toEqual(['a']);
    expect(mandatoryGaps(S(['a']), FIX)).toEqual([]);
  });
});

describe('frameworkGaps', () => {
  it('counts mapped and missing per curated framework, in curated order', () => {
    const curated = [{ key: 'F1', label: 'Fone' }, { key: 'F2', label: 'Ftwo' }, { key: 'F3', label: 'Fthree' }];
    expect(frameworkGaps(S(['b']), FIX, curated)).toEqual([
      { key: 'F1', label: 'Fone', total: 2, have: 1, missing: 1 },
      { key: 'F2', label: 'Ftwo', total: 1, have: 1, missing: 0 },
      { key: 'F3', label: 'Fthree', total: 0, have: 0, missing: 0 },
    ]);
  });
});

describe('daysUntilMonth', () => {
  it('counts days to the 1st of a future month', () => {
    expect(daysUntilMonth('2026-07-05T12:00:00Z', '2026-08')).toBe(27);
  });
  it('is 0 on the 1st of the target month', () => {
    expect(daysUntilMonth('2026-07-01T00:00:00Z', '2026-07')).toBe(0);
  });
  it('is negative for a past month', () => {
    expect(daysUntilMonth('2026-07-05T00:00:00Z', '2026-06')).toBe(-34);
  });
  it('returns null on malformed input', () => {
    expect(daysUntilMonth('2026-07-05T00:00:00Z', '2026-13')).toBeNull();
    expect(daysUntilMonth('2026-07-05T00:00:00Z', 'garbage')).toBeNull();
    expect(daysUntilMonth('not-a-date', '2026-08')).toBeNull();
  });
});

describe('auditTamperGaps', () => {
  it('counts missing and missing-critical among tagged ids only', () => {
    expect(auditTamperGaps(S([]), ['a', 'c'], FIX)).toEqual({ missing: 2, missingCritical: 1, total: 2 });
    expect(auditTamperGaps(S(['a', 'c']), ['a', 'c'], FIX)).toEqual({ missing: 0, missingCritical: 0, total: 2 });
  });
});

describe('orgScopeGapCount', () => {
  it('counts unchecked org-scope controls only', () => {
    expect(orgScopeGapCount(S([]), FIX)).toBe(2);
    expect(orgScopeGapCount(S(['a']), FIX)).toBe(1);
  });
});

describe('real-catalog spot checks', () => {
  it('AI control ids are computable from the catalog', () => {
    expect(CONTROLS.some(c => (c.service ?? '').includes('Bedrock') || c.id.startsWith('IS-BEDROCK'))).toBe(true);
  });
  it('SEV_WEIGHT covers every catalog severity', () => {
    for (const c of CONTROLS) expect(SEV_WEIGHT[c.sev], c.sev).toBeGreaterThan(0);
  });
});
