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

  it('lifecycle covers all 11 MITRE tactics in order', () => {
    expect(LIFECYCLE.map((t) => t.tactic)).toEqual([
      'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion',
      'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Exfiltration', 'Impact',
    ]);
  });

  it('every chain id has a matching actor', () => {
    for (const ch of CHAINS) expect(ACTORS[ch.id], ch.id).toBeTruthy();
  });

  it('unpopulated tactics have no controls; populated have at least one', () => {
    for (const t of LIFECYCLE)
      expect(t.controls.length > 0).toBe(t.populated);
  });
});
