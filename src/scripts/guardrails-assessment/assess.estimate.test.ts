import { describe, it, expect } from 'vitest';
import { LEVEL_FRAC, estimateCoverage, estimateCoveredIds } from './assess';

// Minimal structural catalog + phases — deliberately does NOT import the private control catalog.
const CAT = { groups: { g1: { weight: 10 }, g2: { weight: 5 }, g3: { weight: 5 } } };
const PH = [
  { n: 1, name: 'P1', color: '#111111', groups: ['g1'] },
  { n: 2, name: 'P2', color: '#222222', groups: ['g2', 'g3'] },
];

describe('LEVEL_FRAC', () => {
  it('maps None/Some/Most/All to fractions', () => {
    expect([...LEVEL_FRAC]).toEqual([0, 0.34, 0.67, 1]);
  });
});

describe('estimateCoverage', () => {
  it('empty levels score 0 overall and per phase', () => {
    const r = estimateCoverage({}, CAT, PH);
    expect(r.pct).toBe(0);
    expect(r.perPhase.map(p => p.pct)).toEqual([0, 0]);
  });

  it('all-All levels score 1 overall and per phase', () => {
    const r = estimateCoverage({ g1: 3, g2: 3, g3: 3 }, CAT, PH);
    expect(r.pct).toBe(1);
    expect(r.perPhase.map(p => p.pct)).toEqual([1, 1]);
  });

  it('is weight-weighted across groups and phases', () => {
    // g1 fully covered, g2/g3 empty → 10 of 20 total weight.
    const r = estimateCoverage({ g1: 3 }, CAT, PH);
    expect(r.pct).toBeCloseTo(0.5, 10);
    expect(r.perPhase[0].pct).toBeCloseTo(1, 10);
    expect(r.perPhase[1].pct).toBeCloseTo(0, 10);
  });

  it('applies the LEVEL_FRAC ramp per level', () => {
    // g1 at Some(1) → 0.34 of g1's weight; nothing else.
    const r = estimateCoverage({ g1: 1 }, CAT, PH);
    expect(r.pct).toBeCloseTo((10 * 0.34) / 20, 10);
    expect(r.perPhase[0].pct).toBeCloseTo(0.34, 10);
  });

  it('treats a missing group as level 0', () => {
    // Only g2 set; g1 and g3 absent from levels → level 0.
    const r = estimateCoverage({ g2: 3 }, CAT, PH);
    expect(r.pct).toBeCloseTo(0.25, 10); // 5 of 20
    expect(r.perPhase[0].pct).toBeCloseTo(0, 10); // g1 missing
    expect(r.perPhase[1].pct).toBeCloseTo(0.5, 10); // g2 full, g3 empty
  });

  it('counts every catalog group in the overall, even one no phase references', () => {
    const cat = { groups: { g1: { weight: 10 }, g2: { weight: 5 }, g3: { weight: 5 }, g4: { weight: 10 } } };
    const r = estimateCoverage({ g4: 3 }, cat, PH);
    expect(r.pct).toBeCloseTo(10 / 30, 10); // g4 weight counts in overall
    expect(r.perPhase.map(p => p.pct)).toEqual([0, 0]); // but not in any phase
  });

  it('clamps unknown/out-of-range levels to 0', () => {
    const r = estimateCoverage({ g1: 9 as unknown as number }, CAT, PH);
    expect(r.pct).toBe(0);
  });
});

describe('estimateCoveredIds', () => {
  // Ids deliberately given out of sort order to prove the stable id-sort inside each group.
  const REP = [
    { id: 'IS-A-3', group: 'g1' },
    { id: 'IS-A-1', group: 'g1' },
    { id: 'IS-A-2', group: 'g1' },
    { id: 'IS-B-2', group: 'g2' },
    { id: 'IS-B-1', group: 'g2' },
  ];

  it('empty levels cover nothing', () => {
    expect(estimateCoveredIds({}, REP).size).toBe(0);
  });

  it('all-All covers every id', () => {
    const covered = estimateCoveredIds({ g1: 3, g2: 3 }, REP);
    expect(covered.size).toBe(5);
    for (const c of REP) expect(covered.has(c.id)).toBe(true);
  });

  it('a group at level Some (1) covers ~34% of its ids, lowest ids first', () => {
    // round(0.34 * 3) = 1 for g1; g2 absent → level 0 → 0.
    const covered = estimateCoveredIds({ g1: 1 }, REP);
    expect(covered.size).toBe(1);
    expect(covered.has('IS-A-1')).toBe(true); // lexicographically smallest in g1
    expect(covered.has('IS-A-2')).toBe(false);
    expect(covered.has('IS-B-1')).toBe(false); // g2 untouched
  });

  it('a group at level Most (2) covers ~67% by stable sort', () => {
    // round(0.67 * 3) = 2 → the two lowest ids in g1.
    const covered = estimateCoveredIds({ g1: 2 }, REP);
    expect([...covered].sort()).toEqual(['IS-A-1', 'IS-A-2']);
  });

  it('is deterministic and independent of input order', () => {
    const a = estimateCoveredIds({ g1: 2, g2: 1 }, REP);
    const shuffled = [REP[3], REP[0], REP[4], REP[2], REP[1]];
    const b = estimateCoveredIds({ g1: 2, g2: 1 }, shuffled);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('treats an out-of-range level as 0', () => {
    expect(estimateCoveredIds({ g1: 9 as unknown as number }, REP).size).toBe(0);
  });
});
