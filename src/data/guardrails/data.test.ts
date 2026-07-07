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

describe('attack mapping integrity', () => {
  const TECH_RE = /^T\d{4}(\.\d{3})?$/;
  const IAAS_TACTICS = new Set([
    'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation',
    'Defense Impairment', 'Stealth', 'Credential Access', 'Discovery',
    'Lateral Movement', 'Collection', 'Exfiltration', 'Impact',
  ]);

  it('still has exactly 122 controls after regeneration', () => {
    expect(CONTROLS).toHaveLength(122);
  });

  it('every attack id is a v19-shaped technique id', () => {
    for (const c of CONTROLS) for (const t of c.attack) {
      expect(t, `bad technique ${t} on ${c.id}`).toMatch(TECH_RE);
    }
  });

  it('tactics are non-empty iff attack is non-empty, and drawn from the 12 IaaS tactics', () => {
    for (const c of CONTROLS) {
      expect(c.tactics.length > 0, `tactic/technique mismatch on ${c.id}`).toBe(c.attack.length > 0);
      for (const t of c.tactics) expect(IAAS_TACTICS.has(t), `unknown tactic ${t} on ${c.id}`).toBe(true);
    }
  });

  it('attack data actually flowed (attestation gate open)', () => {
    expect(CONTROLS.filter(c => c.attack.length > 0).length).toBeGreaterThanOrEqual(100);
  });

  it('spot checks match the catalog adjudications', () => {
    const byId = Object.fromEntries(CONTROLS.map(c => [c.id, c]));
    expect(byId['IS-CT-PV-1'].attack).toContain('T1685.002');
    expect(byId['IS-ORG-PV-1'].attack).toContain('T1666');
    expect(byId['IS-BEDROCK-PV-3'].attack).toContain('T1078.004');
    for (const c of CONTROLS) expect(c.attack).not.toContain('T1562.008'); // no revoked v18 ids
  });
});
