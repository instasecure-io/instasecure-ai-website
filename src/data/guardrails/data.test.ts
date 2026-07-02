import { describe, it, expect } from 'vitest';
import { SCENARIOS } from './scenarios';
import { CONTROLS } from './controls';
import { THREATS } from './threats';

describe('guardrails data integrity', () => {
  const ids = new Set(CONTROLS.map(c => c.id));

  it('has 16 scenarios and 122 controls', () => {
    expect(SCENARIOS).toHaveLength(16);
    expect(CONTROLS).toHaveLength(122);
  });

  it('every scenario option and correct id resolves to a control', () => {
    for (const s of SCENARIOS) {
      expect(s.options).toHaveLength(4);
      expect(s.options).toContain(s.correct);
      for (const opt of s.options) expect(ids.has(opt)).toBe(true);
    }
  });

  it('every scenario threat exists in THREATS', () => {
    for (const s of SCENARIOS) expect(THREATS[s.threat]).toBeTruthy();
  });
});
