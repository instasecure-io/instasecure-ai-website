export type LearnFormat = 'game' | 'assessment' | 'simulator' | 'guide';
export type LearnCategoryId = 'interactive' | 'guides' | 'blog';
/** Items are registered per category — except blog, which is fed by the content collection. */
export type LearnItemCategoryId = Exclude<LearnCategoryId, 'blog'>;

export interface LearnCategory {
  id: LearnCategoryId;
  label: string;
  description: string;
  href: string;
}

export interface LearnItem {
  href: string;
  /** Long display title for hub cards. */
  title: string;
  /** Compact label for nav rows (and a future mega-menu). */
  shortTitle: string;
  /** One-line description for nav rows. */
  blurb: string;
  eyebrow: string;
  format: LearnFormat;
  category: LearnItemCategoryId;
  summary: string;
  readingTime: string;
  topics: string[];
  cta: string;
  featured?: boolean;
}

export const LEARN_CATEGORIES: LearnCategory[] = [
  {
    id: 'interactive',
    label: 'Interactive Tools',
    description: 'Games, simulators, and self-assessments — learn by doing.',
    href: '/learn#interactive',
  },
  {
    id: 'guides',
    label: 'Field Guides',
    description: 'Vendor-neutral deep dives on cloud security architecture.',
    href: '/learn#guides',
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Announcements, demos, and product education.',
    href: '/blog',
  },
];

export const LEARN_ITEMS: LearnItem[] = [
  {
    href: '/learn/guardrails-challenge',
    title: 'Guardrails Challenge — can you pick the control that stops each attack?',
    shortTitle: 'Guardrails Challenge',
    blurb: 'Timed quiz: pick the guardrail that stops each attack',
    eyebrow: 'Interactive game',
    format: 'game',
    category: 'interactive',
    summary: 'A timed quiz on a representative sample of InstaSecure\'s 122 AWS preventive guardrails. Read a real cloud breach scenario, then pick the one guardrail (of four) that stops it cold. Score, streaks, ranks, and a browser leaderboard.',
    readingTime: '5 min',
    topics: ['Quiz', 'SCP', 'RCP', 'Data Perimeter'],
    cta: 'Play the challenge →',
    featured: true,
  },
  {
    href: '/learn/guardrails-assessment',
    title: 'Guardrails Assessment — how many of the 122 do you actually enforce?',
    shortTitle: 'Guardrails Assessment',
    blurb: 'Score your enforced coverage + get a gap report',
    eyebrow: 'Interactive assessment',
    format: 'assessment',
    category: 'interactive',
    summary: 'Estimate how much of each guardrail group your org enforces and get a severity-weighted coverage snapshot mapped to the MITRE ATT&CK kill chain — the stages you cover and where a precise scan comes next. A rough self-estimate; nothing leaves the page.',
    readingTime: '10 min',
    topics: ['Assessment', 'SCP', 'RCP', 'Estimate'],
    cta: 'Start the assessment →',
  },
  {
    href: '/learn/aws-organizational-policies',
    title: 'AWS Organizational Policy Controls — interactive simulator',
    shortTitle: 'AWS Organizational Policies',
    blurb: 'Interactive SCP / RCP / Data Perimeter simulator',
    eyebrow: 'Interactive simulator',
    format: 'simulator',
    category: 'interactive',
    summary: 'Try AWS organizational policies live: click through six trust scenarios and watch which gate blocks each one. Below the simulator, a tabbed deep-dive on Effective Permissions, Data Perimeter, SCPs, and RCPs — and the AWS evaluation logic that ties them together.',
    readingTime: 'Hands-on',
    topics: ['Simulator', 'SCP', 'RCP', 'Data Perimeter'],
    cta: 'Open the simulator →',
  },
  {
    href: '/learn/cloud-architecture-gaps',
    title: 'Cloud Hardening as a Proactive Defense Against Adversarial AI',
    shortTitle: 'Cloud Architecture Gaps',
    blurb: 'Field guide: tenancy, perimeter, blast radius',
    eyebrow: 'Field guide',
    format: 'guide',
    category: 'guides',
    summary: 'AI compressed cloud reconnaissance from weeks to minutes. The architectural problems it exploits — tenancy, perimeter, and blast radius — were always there. Here\'s a vendor-neutral guide to closing them with AWS-native primitives.',
    readingTime: '15 min read',
    topics: ['Tenancy', 'Data Perimeter', 'IAM Blast Radius'],
    cta: 'Read the field guide →',
  },
];
