import { describe, it, expect } from 'vitest';
import { estimateCoverage, estimateCoveredIds } from './assess';

// Minimal structural catalog + phases — deliberately does NOT import the private control catalog.
// Estimates are per-group fractions {0, .25, .5, .75, 1}; an ABSENT key means "no estimate yet".
const CAT = { groups: { g1: { weight: 10, count: 4 }, g2: { weight: 5, count: 2 }, g3: { weight: 5, count: 2 } } };
const PH = [
  { n: 1, name: 'P1', color: '#111111', groups: ['g1'] },
  { n: 2, name: 'P2', color: '#222222', groups: ['g2', 'g3'] },
];

describe('estimateCoverage (fractional estimates)', () => {
  it('empty estimates score 0 overall and per phase, nothing answered', () => {
    const r = estimateCoverage({}, CAT, PH);
    expect(r.pct).toBe(0);
    expect(r.perPhase.map(p => p.pct)).toEqual([0, 0]);
    expect(r.answered).toBe(0);
    expect(r.expected).toBe(0);
    expect(r.controlsTotal).toBe(8);
    expect(r.groupsTotal).toBe(3);
  });

  it('all-All (1) scores 1 overall and per phase', () => {
    const r = estimateCoverage({ g1: 1, g2: 1, g3: 1 }, CAT, PH);
    expect(r.pct).toBe(1);
    expect(r.perPhase.map(p => p.pct)).toEqual([1, 1]);
    expect(r.answered).toBe(3);
    expect(r.expected).toBe(8); // round(4 + 2 + 2)
  });

  it('is weight-weighted across groups and phases', () => {
    const r = estimateCoverage({ g1: 1 }, CAT, PH);
    expect(r.pct).toBeCloseTo(0.5, 10); // 10 of 20
    expect(r.perPhase[0].pct).toBeCloseTo(1, 10);
    expect(r.perPhase[1].pct).toBeCloseTo(0, 10);
  });

  it('applies the fraction directly — no level ramp', () => {
    const r = estimateCoverage({ g1: 0.25 }, CAT, PH);
    expect(r.pct).toBeCloseTo((10 * 0.25) / 20, 10);
    expect(r.perPhase[0].pct).toBeCloseTo(0.25, 10);
    expect(r.expected).toBe(1); // round(0.25 * 4)
  });

  it('distinguishes an unanswered group from an explicit None (0)', () => {
    const none = estimateCoverage({ g1: 0 }, CAT, PH);
    expect(none.answered).toBe(1); // None IS an answer
    expect(none.pct).toBe(0);
    expect(none.perPhase[0].answered).toBe(1);
    const absent = estimateCoverage({}, CAT, PH);
    expect(absent.answered).toBe(0); // absence is not
    expect(absent.perPhase[0].answered).toBe(0);
  });

  it('treats a missing group as 0 in coverage (but not answered)', () => {
    const r = estimateCoverage({ g2: 1 }, CAT, PH);
    expect(r.pct).toBeCloseTo(0.25, 10); // 5 of 20
    expect(r.answered).toBe(1);
    expect(r.perPhase[0].pct).toBeCloseTo(0, 10);
    expect(r.perPhase[1].pct).toBeCloseTo(0.5, 10);
  });

  it('counts every catalog group in the overall + controlsTotal, even one no phase references', () => {
    const cat = { groups: { g1: { weight: 10, count: 4 }, g2: { weight: 5, count: 2 }, g3: { weight: 5, count: 2 }, g4: { weight: 10, count: 3 } } };
    const r = estimateCoverage({ g4: 1 }, cat, PH);
    expect(r.pct).toBeCloseTo(10 / 30, 10); // g4 weight counts in overall
    expect(r.controlsTotal).toBe(11);
    expect(r.perPhase.map(p => p.pct)).toEqual([0, 0]); // but not in any phase
  });
});

describe('estimateCoveredIds (fractional estimates)', () => {
  // Ids deliberately given out of sort order to prove the stable id-sort inside each group.
  const REP = [
    { id: 'IS-A-3', group: 'g1' },
    { id: 'IS-A-1', group: 'g1' },
    { id: 'IS-A-2', group: 'g1' },
    { id: 'IS-B-2', group: 'g2' },
    { id: 'IS-B-1', group: 'g2' },
  ];

  it('empty estimates cover nothing', () => {
    expect(estimateCoveredIds({}, REP).size).toBe(0);
  });

  it('all-1 covers every id', () => {
    const covered = estimateCoveredIds({ g1: 1, g2: 1 }, REP);
    expect(covered.size).toBe(5);
    for (const c of REP) expect(covered.has(c.id)).toBe(true);
  });

  it('a group at .25 covers ~1/4 of its ids (round), lowest ids first', () => {
    // round(0.25 * 3) = 1 for g1; g2 absent → 0.
    const covered = estimateCoveredIds({ g1: 0.25 }, REP);
    expect(covered.size).toBe(1);
    expect(covered.has('IS-A-1')).toBe(true); // lexicographically smallest in g1
    expect(covered.has('IS-A-2')).toBe(false);
    expect(covered.has('IS-B-1')).toBe(false); // g2 untouched
  });

  it('a group at .75 covers ~3/4 by stable sort', () => {
    // round(0.75 * 3) = 2 → the two lowest ids in g1.
    const covered = estimateCoveredIds({ g1: 0.75 }, REP);
    expect([...covered].sort()).toEqual(['IS-A-1', 'IS-A-2']);
  });

  it('an explicit None (0) covers nothing in that group', () => {
    expect(estimateCoveredIds({ g1: 0 }, REP).size).toBe(0);
  });

  it('is deterministic and independent of input order', () => {
    const a = estimateCoveredIds({ g1: 0.75, g2: 0.25 }, REP);
    const shuffled = [REP[3], REP[0], REP[4], REP[2], REP[1]];
    const b = estimateCoveredIds({ g1: 0.75, g2: 0.25 }, shuffled);
    expect([...a].sort()).toEqual([...b].sort());
  });
});
