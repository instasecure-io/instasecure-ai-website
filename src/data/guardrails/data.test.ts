import { describe, it, expect } from 'vitest';
import { SCENARIOS } from './scenarios';
import { CONTROLS } from './controls';
import { THREATS } from './threats';
import { GROUPS } from './groups';
import { PHASES } from './phases';
import { CURATED_FRAMEWORKS } from './frameworks';

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

describe('guardrails assessment data integrity', () => {
  it('every control group exists in GROUPS', () => {
    for (const c of CONTROLS) expect(GROUPS[c.group], `unknown group ${c.group} on ${c.id}`).toBeTruthy();
  });

  it('phases partition the groups exactly and agree with GroupMeta.phase', () => {
    const phaseGroups = PHASES.flatMap(p => p.groups);
    expect(new Set(phaseGroups).size).toBe(phaseGroups.length);
    expect(new Set(phaseGroups)).toEqual(new Set(Object.keys(GROUPS)));
    for (const [key, meta] of Object.entries(GROUPS)) {
      const phase = PHASES.find(p => p.groups.includes(key));
      expect(phase?.n, `phase mismatch for ${key}`).toBe(meta.phase);
    }
  });

  it('every curated framework maps to at least one control', () => {
    for (const f of CURATED_FRAMEWORKS) {
      expect(CONTROLS.some(c => c.fw.includes(f.key)), `no control maps to ${f.key}`).toBe(true);
    }
  });

  it('scope values are non-empty and org-scope controls exist', () => {
    for (const c of CONTROLS) expect(typeof c.scope === 'string' && c.scope.length > 0, `bad scope on ${c.id}`).toBe(true);
    expect(CONTROLS.some(c => c.scope === 'org')).toBe(true);
  });

  it('audit-tampering tagged controls exist', () => {
    expect(CONTROLS.filter(c => c.tags.includes('audit-tampering')).length).toBeGreaterThan(0);
  });
});
