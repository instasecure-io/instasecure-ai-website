import { describe, it, expect } from 'vitest';
import { seededShuffle, scoreRound, rankOf, buildRounds, mergeBoard, SEEDED_BOARD } from './game';

describe('seededShuffle', () => {
  it('is deterministic for a given seed', () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 42)).toEqual(seededShuffle([1, 2, 3, 4, 5], 42));
  });
  it('returns a permutation (same length and members)', () => {
    const out = seededShuffle([1, 2, 3, 4, 5], 7);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    seededShuffle(input, 1);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe('scoreRound', () => {
  it('correct with full timer and no streak = 150', () => {
    expect(scoreRound({ correct: true, timeLeft: 20, timerOn: true, streak: 0 })).toBe(150);
  });
  it('adds streak bonus using the pre-increment streak', () => {
    expect(scoreRound({ correct: true, timeLeft: 20, timerOn: true, streak: 3 })).toBe(180);
  });
  it('flat 25 speed bonus when timer off', () => {
    expect(scoreRound({ correct: true, timeLeft: 0, timerOn: false, streak: 0 })).toBe(125);
  });
  it('wrong answer scores 0 regardless of streak', () => {
    expect(scoreRound({ correct: false, timeLeft: 20, timerOn: true, streak: 5 })).toBe(0);
  });
});

describe('rankOf (rounds=8, max=1200)', () => {
  it('>= 0.85 -> Perimeter Architect', () => {
    expect(rankOf(1020, 8).title).toBe('Perimeter Architect');
  });
  it('>= 0.65 and < 0.85 -> Guardrail Engineer', () => {
    expect(rankOf(1019, 8).title).toBe('Guardrail Engineer');
    expect(rankOf(780, 8).title).toBe('Guardrail Engineer');
  });
  it('>= 0.4 and < 0.65 -> Cloud Defender', () => {
    expect(rankOf(779, 8).title).toBe('Cloud Defender');
    expect(rankOf(480, 8).title).toBe('Cloud Defender');
  });
  it('< 0.4 -> Detection Believer', () => {
    expect(rankOf(479, 8).title).toBe('Detection Believer');
  });
});

describe('buildRounds', () => {
  const scenarios = Array.from({ length: 16 }, (_, i) => ({
    id: 's' + i, threat: 't', title: 'T', scenario: 'x', explain: 'y', correct: 'a',
    options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
  }));
  it('returns exactly `rounds` scenarios', () => {
    expect(buildRounds(scenarios, 123, 8)).toHaveLength(8);
  });
  it('is deterministic and shuffles each option set', () => {
    const a = buildRounds(scenarios, 123, 8);
    const b = buildRounds(scenarios, 123, 8);
    expect(a.map(s => s.id)).toEqual(b.map(s => s.id));
    expect(a[0].options).toHaveLength(4);
  });
});

describe('mergeBoard', () => {
  it('inserts, sorts descending, caps at 10', () => {
    const out = mergeBoard(SEEDED_BOARD, { name: 'me', score: 1500, when: '2026-07-02' });
    expect(out).toHaveLength(6);
    expect(out[0]).toEqual({ name: 'me', score: 1500, when: '2026-07-02' });
  });
  it('never drops a seeded entry even on name collision', () => {
    const board = [{ name: 'me', score: 100, when: 'seed' }];
    const out = mergeBoard(board, { name: 'me', score: 200, when: '2026-07-02' });
    expect(out).toHaveLength(2);
  });
  it('replaces a prior non-seed entry of the same name with a lower-or-equal score', () => {
    const board = [{ name: 'me', score: 100, when: '2026-07-01' }];
    const out = mergeBoard(board, { name: 'me', score: 200, when: '2026-07-02' });
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(200);
  });
});
