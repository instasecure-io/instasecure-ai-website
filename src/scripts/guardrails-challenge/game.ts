// Pure game logic — no DOM, no localStorage, no Date/Math.random. Seeds/timestamps are passed in.
export interface BoardEntry { name: string; score: number; when: string }
export interface PlayOption { id: string; name: string }
export interface PlayScenario {
  id: string; threat: string; title: string; scenario: string; explain: string;
  correct: string; options: PlayOption[];
}

export const SEEDED_BOARD: BoardEntry[] = [
  { name: 'perimeter_paul', score: 1420, when: 'seed' },
  { name: 'scp_or_die', score: 1310, when: 'seed' },
  { name: 'denyall_dana', score: 1180, when: 'seed' },
  { name: 'ctrl_tower_tina', score: 990, when: 'seed' },
  { name: 'least_priv_lee', score: 870, when: 'seed' },
];

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function scoreRound(o: { correct: boolean; timeLeft: number; timerOn: boolean; streak: number }): number {
  if (!o.correct) return 0;
  const speedBonus = o.timerOn ? Math.round(o.timeLeft * 2.5) : 25;
  return 100 + speedBonus + o.streak * 10;
}

export function rankOf(score: number, rounds: number): { title: string; note: string } {
  const r = score / (rounds * 150);
  if (r >= 0.85) return { title: 'Perimeter Architect', note: 'You could teach this. The wall holds.' };
  if (r >= 0.65) return { title: 'Guardrail Engineer', note: 'Strong instincts — a few doors still ajar.' };
  if (r >= 0.4) return { title: 'Cloud Defender', note: 'Solid fundamentals. The advanced patterns bite.' };
  return { title: 'Detection Believer', note: 'You watch attacks happen. Prevention is a mindset shift.' };
}

export function buildRounds(scenarios: PlayScenario[], seed: number, rounds: number): PlayScenario[] {
  return seededShuffle(scenarios, seed)
    .slice(0, rounds)
    .map((s, i) => ({ ...s, options: seededShuffle(s.options, seed + i) }));
}

export function mergeBoard(board: BoardEntry[], entry: BoardEntry): BoardEntry[] {
  return [...board.filter(b => !(b.name === entry.name && b.when !== 'seed' && b.score <= entry.score)), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
