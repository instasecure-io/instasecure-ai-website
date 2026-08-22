import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ATTACK_STEPS,
  DEFENSE_LAYERS,
  LADDER_CONTROL_IDS,
  DEV_ACCOUNT,
  PROD_ACCOUNT,
  ATTACKER_PRINCIPAL,
  ASSUMED_PRINCIPAL,
  firstSurvivingWall,
  isBreached,
  TOTAL_CALLS,
  callsSucceeded,
  layersEnforced,
  dataExposed,
  SCENE_ASSETS,
  stepSucceeded,
  STEP_FOCUS,
} from '@/data/attack-sequence';
import { REPRESENTATIVE_CONTROLS } from '@/data/guardrails/representative-controls';

describe('attack sequence invariants', () => {
  it('steps are numbered 1..n in order with unique ids', () => {
    expect(ATTACK_STEPS.map(s => s.n)).toEqual(ATTACK_STEPS.map((_, i) => i + 1));
    const ids = ATTACK_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every step has a command and an undefended output', () => {
    for (const s of ATTACK_STEPS) {
      expect(s.cmd.trim().startsWith('aws ')).toBe(true);
      expect(s.attackOut.trim().length).toBeGreaterThan(0);
    }
  });

  it('a step either has a wall or explains why it deliberately has none', () => {
    for (const s of ATTACK_STEPS) {
      if (s.wall === null) {
        expect(s.noWallReason, `step ${s.n} has no wall and no reason`).toBeTruthy();
      } else {
        expect(s.noWallReason).toBeUndefined();
      }
    }
  });

  it('every wall names a control that is already public', () => {
    const published = new Set(REPRESENTATIVE_CONTROLS.map(c => c.id));
    for (const id of LADDER_CONTROL_IDS) {
      expect(published.has(id), `${id} is not in representative-controls.ts`).toBe(true);
    }
  });

  it('wall name and severity mirror the public catalog exactly', () => {
    for (const s of ATTACK_STEPS) {
      if (!s.wall) continue;
      const rep = REPRESENTATIVE_CONTROLS.find(c => c.id === s.wall!.control)!;
      expect(s.wall.name).toBe(rep.name);
      expect(s.wall.sev).toBe(rep.sev);
    }
  });

  it('every wall carries a deny message, a lever and a rationale', () => {
    for (const s of ATTACK_STEPS) {
      if (!s.wall) continue;
      expect(s.wall.denyOut).toMatch(/AccessDenied/);
      expect(s.wall.denyOut).toMatch(/with an explicit deny in a/);
      expect(s.wall.lever.length).toBeGreaterThan(0);
      expect(s.wall.why.length).toBeGreaterThan(80);
    }
  });

  it('deny wording matches the policy type it claims', () => {
    const phrase: Record<string, string> = {
      SCP: 'with an explicit deny in a service control policy',
      RCP: 'with an explicit deny in a resource control policy',
      'VPC endpoint policy': 'with an explicit deny in a VPC endpoint policy',
    };
    for (const s of ATTACK_STEPS) {
      if (!s.wall) continue;
      expect(s.wall.denyOut, `step ${s.n} (${s.wall.kind})`).toContain(phrase[s.wall.kind]);
    }
  });

  // The scene is fiction. The recording it is derived from is not — it contains a
  // real account ID, which must never reach the home page.
  it('renders only the fictional account IDs', () => {
    const blob = JSON.stringify(ATTACK_STEPS);
    for (const acct of blob.match(/\b\d{12}\b/g) ?? []) {
      expect([DEV_ACCOUNT, PROD_ACCOUNT]).toContain(acct);
    }
    expect(blob).not.toContain('345857777094');
    expect(blob).not.toContain('94222');
  });

  // IS-PERIMETER-PV-16 is scoped to arn:aws:iam::*:user/*. If the narrative showed a
  // role as the acting principal before the lateral move, that citation would be wrong.
  it('the acting principal is an IAM user until the lateral move', () => {
    expect(ATTACKER_PRINCIPAL).toMatch(/:user\//);
    expect(ASSUMED_PRINCIPAL).toMatch(/:assumed-role\//);
    const lateral = ATTACK_STEPS.find(s => s.id === 'lateral')!;
    for (const s of ATTACK_STEPS.filter(s => s.n < lateral.n)) {
      expect(s.wall?.denyOut ?? '', `step ${s.n}`).not.toContain('assumed-role');
    }
  });
});

describe('scene diagram stays in step with the ladder', () => {
  it('every asset tile maps to a real step', () => {
    const steps = new Set(ATTACK_STEPS.map(s => s.n));
    for (const a of SCENE_ASSETS) {
      expect(steps.has(a.step), `${a.key} -> step ${a.step}`).toBe(true);
      expect(a.held.name).not.toBe(a.lost.name);
    }
    expect(new Set(SCENE_ASSETS.map(a => a.key)).size).toBe(SCENE_ASSETS.length);
  });

  it('tiles fall in step order as layers come off', () => {
    // Nothing switched off: only tiles before the outermost wall have fallen.
    expect(SCENE_ASSETS.filter(a => stepSucceeded(a.step)).length).toBe(0);
    // Everything off: every tile has fallen.
    expect(SCENE_ASSETS.every(a => stepSucceeded(a.step, LADDER_CONTROL_IDS))).toBe(true);
  });

  it('every focused tile is a real asset key, and each lit step focuses one', () => {
    const keys = new Set(SCENE_ASSETS.map(a => a.key));
    for (const [step, spec] of Object.entries(STEP_FOCUS)) {
      for (const k of spec.tiles) expect(keys.has(k as never), `step ${step} -> ${k}`).toBe(true);
      // Step 01 is the attacker bubble, not a tile; every other step needs a subject.
      if (step !== '1') expect(spec.tiles.length, `step ${step} focuses nothing`).toBeGreaterThan(0);
      expect(['dev', 'prod'], `step ${step} account`).toContain(spec.account);
    }
    expect(Object.keys(STEP_FOCUS).map(Number).sort((a, b) => a - b))
      .toEqual(ATTACK_STEPS.map(s => s.n));
  });

  // The whole point of the lateral move is that the action leaves dev for prod.
  it('the focused account switches to prod exactly at the lateral move', () => {
    const lateral = ATTACK_STEPS.find(s => s.id === 'lateral')!.n;
    for (const s of ATTACK_STEPS) {
      expect(STEP_FOCUS[s.n].account, `step ${s.n}`).toBe(s.n < lateral ? 'dev' : 'prod');
    }
  });

  // TuesdayAttackScene's script is `is:inline` and cannot import, so it holds a
  // verbatim copy of STEP_FOCUS. Drift would desync the two stages' focus.
  it('the scene inline script copy of STEP_FOCUS matches', () => {
    const scene = readFileSync(
      new URL('../components/sections/TuesdayAttackScene.astro', import.meta.url),
      'utf8',
    );
    const m = scene.match(/var STEP_FOCUS = (\{[^;]*\});/);
    expect(m, 'inline STEP_FOCUS literal not found').toBeTruthy();
    // eslint-disable-next-line no-eval
    const inline = eval(`(${m![1]})`) as Record<number, string[]>;
    expect(inline).toEqual(STEP_FOCUS);
  });

  // The .astro markup carries the default copy so the section reads correctly
  // without JS. If SCENE_ASSETS drifts from it, the page flashes the wrong text.
  it('server-rendered defense tiles match the held copy', () => {
    const scene = readFileSync(
      new URL('../components/sections/TuesdayAttackScene.astro', import.meta.url),
      'utf8',
    );
    const defense = scene.slice(scene.indexOf('data-stage="defense"'));
    for (const a of SCENE_ASSETS) {
      expect(defense, `${a.key} name`).toContain(a.held.name);
      expect(defense, `${a.key} tag`).toContain(a.held.tag);
    }
  });
});

describe('defense-in-depth peeling', () => {
  it('exposes the walls in step order', () => {
    expect(DEFENSE_LAYERS.map(l => l.step)).toEqual([...DEFENSE_LAYERS.map(l => l.step)].sort((a, b) => a - b));
    expect(DEFENSE_LAYERS.length).toBeGreaterThanOrEqual(3);
  });

  it('stops at the outermost wall when nothing is switched off', () => {
    expect(firstSurvivingWall()!.n).toBe(2);
    expect(isBreached()).toBe(false);
  });

  it('falls through to the next wall as each layer is switched off', () => {
    const seen: number[] = [];
    const off: string[] = [];
    let wall = firstSurvivingWall(off);
    while (wall) {
      seen.push(wall.n);
      off.push(wall.wall!.control);
      wall = firstSurvivingWall(off);
    }
    expect(seen).toEqual(DEFENSE_LAYERS.map(l => l.step));
  });

  it('call counts add up to the attack tab headline stat', () => {
    expect(TOTAL_CALLS).toBe(ATTACK_STEPS.reduce((n, s) => n + s.calls, 0));
    // Only the undeniable identity check gets through with everything enforced.
    expect(callsSucceeded()).toBe(1);
    // Peel everything and the defense tab reports exactly the attack tab.
    expect(callsSucceeded(LADDER_CONTROL_IDS)).toBe(TOTAL_CALLS);
  });

  it('succeeded calls rise monotonically as layers come off', () => {
    let prev = -1;
    for (let i = 0; i <= LADDER_CONTROL_IDS.length; i++) {
      const n = callsSucceeded(LADDER_CONTROL_IDS.slice(0, i));
      expect(n).toBeGreaterThan(prev);
      prev = n;
    }
  });

  it('reports layers enforced and data exposed for the verdict row', () => {
    expect(layersEnforced()).toBe(DEFENSE_LAYERS.length);
    expect(layersEnforced(LADDER_CONTROL_IDS)).toBe(0);
    expect(dataExposed()).toBe('0');
    expect(dataExposed(LADDER_CONTROL_IDS)).toBe('4.2 GB');
  });

  // The whole argument of the section: all layers off === the attack tab.
  it('is breached only when every layer is switched off', () => {
    const all = LADDER_CONTROL_IDS;
    expect(isBreached(all)).toBe(true);
    for (let i = 0; i < all.length; i++) {
      expect(isBreached(all.slice(0, i)), `${i} of ${all.length} disabled`).toBe(false);
    }
  });
});
