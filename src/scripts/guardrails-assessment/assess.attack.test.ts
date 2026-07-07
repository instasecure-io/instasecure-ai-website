import { describe, it, expect } from 'vitest';
import { stepState, lifecycleView, playbookView, attackCompleteness, sharedOpenGaps } from './assess';
import type { PlaybookStep, LifecycleTactic } from '@/data/guardrails/attack-chains';

const chains: { id: string; steps: PlaybookStep[] }[] = [
  { id: 'a', steps: [
    { label: 'x', api: '', technique: 'T1', techniqueName: '', tactic: 'Initial Access', control: 'C1', controlName: 'c1', sev: 'high' },
    { label: 'y', api: '', technique: 'T2', techniqueName: '', tactic: 'Discovery', control: null, controlName: null, sev: null },
    { label: 'z', api: '', technique: 'T3', techniqueName: '', tactic: 'Impact', control: 'C2', controlName: 'c2', sev: 'critical' },
  ] },
  { id: 'b', steps: [
    { label: 'w', api: '', technique: 'T3', techniqueName: '', tactic: 'Impact', control: 'C2', controlName: 'c2', sev: 'critical' },
  ] },
];
const lifecycle: LifecycleTactic[] = [
  { tactic: 'Initial Access', populated: true, controls: [{ control: 'C1', controlName: 'c1', technique: 'T1' }] },
  { tactic: 'Impact', populated: true, controls: [{ control: 'C2', controlName: 'c2', technique: 'T3' }] },
  { tactic: 'Execution', populated: false, controls: [] },
];

describe('attack projections', () => {
  it('stepState maps null → no-control, else closed/open', () => {
    const h = new Set(['C1']);
    expect(stepState(h, 'C1')).toBe('closed');
    expect(stepState(h, 'C2')).toBe('open');
    expect(stepState(h, null)).toBe('no-control');
  });

  it('lifecycleView computes closed/total per tactic', () => {
    const v = lifecycleView(new Set(['C1']), lifecycle);
    expect(v[0]).toMatchObject({ tactic: 'Initial Access', total: 1, closed: 1 });
    expect(v[1].closed).toBe(0);
    expect(v[2]).toMatchObject({ populated: false, total: 0 });
  });

  it('playbookView counts open/detection-only/tactics and attaches stories', () => {
    const v = playbookView(new Set(['C1']), chains, { C1: { title: 't', explain: 'e' } });
    expect(v[0]).toMatchObject({ openLinks: 1, detectionOnly: 1, tacticsCount: 3 });
    expect(v[0].steps[0].scenario).toEqual({ title: 't', explain: 'e' });
    expect(v[0].steps[1].state).toBe('no-control');
    expect(v[0].steps[2].scenario).toBeNull();
  });

  it('attackCompleteness — techniques unique, open by tactic, detection-only by step', () => {
    const c = attackCompleteness(new Set(['C1']), chains, lifecycle);
    expect(c).toEqual({ techniques: 3, openTechniques: 1, openTactics: 1, detectionOnly: 1 });
  });

  it('sharedOpenGaps returns controls open in ≥2 playbooks only', () => {
    const g = sharedOpenGaps(new Set<string>(), chains);
    expect(g['C2']).toBe(2);
    expect(g['C1']).toBeUndefined();
  });
});
