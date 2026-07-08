import { describe, it, expect } from 'vitest';
import { ACTORS, CHAINS, LIFECYCLE } from './attack-chains';
import { CONTROLS } from './controls';

const ids = new Set(CONTROLS.map((c) => c.id));

describe('attack-chains', () => {
  it('every non-null step control exists in the catalog', () => {
    for (const ch of CHAINS)
      for (const s of ch.steps) if (s.control) expect(ids.has(s.control), s.control).toBe(true);
  });

  it('every lifecycle control exists in the catalog', () => {
    for (const t of LIFECYCLE)
      for (const c of t.controls) expect(ids.has(c.control), c.control).toBe(true);
  });

  it('lifecycle covers all 12 ATT&CK v19.1 tactics in order', () => {
    expect(LIFECYCLE.map((t) => t.tactic)).toEqual([
      'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Impairment',
      'Stealth', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Exfiltration', 'Impact',
    ]);
  });

  it('every catalog-covered tactic has a populated lifecycle bucket (none left TBD)', () => {
    const covered = new Set<string>();
    for (const c of CONTROLS) for (const t of c.tactics) covered.add(t);
    const bucket = new Map(LIFECYCLE.map((b) => [b.tactic, b]));
    for (const tac of covered) {
      const b = bucket.get(tac);
      expect(b, `no lifecycle bucket for catalog-covered tactic ${tac}`).toBeTruthy();
      expect(b!.populated, `lifecycle bucket "${tac}" is populated:false but the catalog maps controls to it`).toBe(true);
    }
  });

  it('every chain id has a matching actor', () => {
    for (const ch of CHAINS) expect(ACTORS[ch.id], ch.id).toBeTruthy();
  });

  it('unpopulated tactics have no controls; populated have at least one', () => {
    for (const t of LIFECYCLE)
      expect(t.controls.length > 0).toBe(t.populated);
  });

  it('every chain/lifecycle entry with a control id agrees with the catalog (ATT&CK v19.1 lock)', () => {
    const byId = Object.fromEntries(CONTROLS.map((c) => [c.id, c]));
    const check = (control: string | null | undefined, technique: string | undefined, tactic: string | undefined, where: string) => {
      if (!control) return;
      const c = byId[control];
      expect(c, `unknown control ${control} in ${where}`).toBeTruthy();
      if (technique) expect(c.attack, `technique ${technique} not on ${control} (${where})`).toContain(technique);
      if (tactic) expect(c.tactics, `tactic ${tactic} not on ${control} (${where})`).toContain(tactic);
    };
    for (const ch of CHAINS)
      for (const s of ch.steps) check(s.control, s.technique, s.tactic, `chain ${ch.id}`);
    for (const t of LIFECYCLE)
      for (const c of t.controls) check(c.control, c.technique, t.tactic, `lifecycle ${t.tactic}`);
  });

  it('every tactic string (including null-control steps) is a valid ATT&CK v19.1 IaaS tactic', () => {
    const VALID_TACTICS = new Set([
      'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Impairment',
      'Stealth', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Exfiltration', 'Impact',
    ]);
    for (const ch of CHAINS)
      for (const s of ch.steps)
        expect(VALID_TACTICS.has(s.tactic), `chain ${ch.id} step "${s.label}" has unknown tactic ${s.tactic}`).toBe(true);
    for (const t of LIFECYCLE)
      expect(VALID_TACTICS.has(t.tactic), `lifecycle bucket has unknown tactic ${t.tactic}`).toBe(true);
  });
});
