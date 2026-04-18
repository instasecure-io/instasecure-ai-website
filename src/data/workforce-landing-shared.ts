export const SHARED_PROBLEM = {
  eyebrow: 'The Problem',
  title: "The Invisible IAM Sprawl Problem",
  description: "The problem isn't the cloud — it's the invisible IAM sprawl that makes securing access across accounts, services, and users nearly impossible with today's manual or reactive approaches.",
  points: [
    'Developers creating security exposures through misconfigured permissions',
    'Compliance gaps from unaudited cloud accounts and unmanaged identities',
    'Unapproved cloud resources driving costs and risk',
  ],
};

export const SHARED_SOLUTION = [
  {
    icon: 'lucide:gauge',
    iconColor: 'brand' as const,
    title: 'Identity Security Posture Assessment',
    description: 'Real-time dashboard to baseline your workforce IAM security posture, spot weak configurations, and identify compliance gaps instantly.',
  },
  {
    icon: 'lucide:search',
    iconColor: 'accent' as const,
    title: 'Access Investigation',
    description: 'Pre-defined filters for toxic access. Drill-down by user, service, resource, and scenario — with direct suspend and revoke capabilities.',
  },
  {
    icon: 'lucide:sliders-horizontal',
    iconColor: 'brand' as const,
    title: 'Permission Optimizer',
    description: 'Right-size access at scale across multiple users and accounts, reducing risk while ensuring teams retain only what they need to be productive.',
  },
];

export const SHARED_WHY_MATTERS = [
  { icon: 'lucide:scale', iconColor: 'brand' as const, title: 'Reduce compliance risk', description: 'From excessive and unmanaged permissions — automate access reviews and generate audit evidence on demand.' },
  { icon: 'lucide:shield-check', iconColor: 'accent' as const, title: 'Prevent lateral movement', description: 'And cloud breaches before they happen — by removing the permission paths attackers use.' },
  { icon: 'lucide:piggy-bank', iconColor: 'brand' as const, title: 'Cut costs', description: 'Remove unused or over-provisioned access. Trim the cloud bill attached to orphaned resources.' },
  { icon: 'lucide:eye', iconColor: 'accent' as const, title: 'Visibility CSPM tools miss', description: 'See the actual net permissions — not just what policies allow, but what CloudTrail shows users really used.' },
];
