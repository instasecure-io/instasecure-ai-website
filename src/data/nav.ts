export interface NavLeaf { label: string; href: string; description?: string; }
export interface NavGroup { heading: string; description?: string; items: NavLeaf[]; }
export interface NavEntry {
  label: string;
  href: string;
  children?: NavLeaf[];
  groups?: NavGroup[];
  description?: string;
}

export const PRIMARY_NAV: NavEntry[] = [
  {
    label: 'Products',
    href: '#',
    groups: [
      {
        heading: 'InstaAccess',
        description: 'Preventive cloud controls for non-human identities — service roles, automation, third-party integrations.',
        items: [
          { label: 'Product overview', href: '/instaaccess' },
          { label: 'View 10 use cases', href: '/instaaccess-use-cases' },
        ],
      },
      {
        heading: 'InstaWorkforce',
        description: 'Secure human access to the cloud — least-privilege, just-in-time, policy-aligned.',
        items: [
          { label: 'Product overview', href: '/instaworkforce' },
          { label: 'View 10 use cases', href: '/instaworkforce-use-cases' },
        ],
      },
    ],
  },
  {
    label: 'Use Cases',
    href: '#',
    groups: [
      {
        heading: 'By Product',
        items: [
          { label: 'InstaAccess Use Cases', href: '/instaaccess-use-cases', description: '10 non-human identity use cases' },
          { label: 'InstaWorkforce Use Cases', href: '/instaworkforce-use-cases', description: '10 human-access use cases' },
        ],
      },
      {
        heading: 'Stop Cloud Attacks',
        items: [
          { label: 'Credential Compromise', href: '/credential-compromise', description: 'Block stolen-credential attacks' },
          { label: 'Cloud Zero-Day Attack', href: '/cloud-zero-day-attack-solution', description: 'Defend against unknown exploits' },
          { label: 'Data Perimeter on AWS', href: '/data-perimeter-on-aws', description: 'Trusted identities, resources, networks' },
        ],
      },
      {
        heading: 'Govern Identity & Access',
        items: [
          { label: 'Close Compliance Gap', href: '/close-compliance-gap', description: 'Prove compliance instantly' },
          { label: 'Fix Risks Before Pentest', href: '/fix-risks-before-pentest', description: 'Pen-test prep' },
          { label: 'Who Really Has Access', href: '/who-really-has-access', description: 'Instant visibility' },
          { label: 'Stop Paying for Cloud', href: '/stop-paying-for-cloud', description: 'Right-size and save' },
          { label: 'Walk Into Your Next Audit', href: '/walk-into-your-next-user-access-audit', description: 'Audit-ready evidence' },
        ],
      },
    ],
  },
  { label: 'How It Works', href: '/howitworks' },
  {
    label: 'Learn',
    href: '/learn',
    children: [
      { label: 'Guardrails Challenge', href: '/learn/guardrails-challenge', description: 'Timed quiz: pick the guardrail that stops each attack' },
      { label: 'AWS Organizational Policies', href: '/learn/aws-organizational-policies', description: 'Interactive SCP / RCP / Data Perimeter simulator' },
      { label: 'Cloud Architecture Gaps', href: '/learn/cloud-architecture-gaps', description: 'Field guide: tenancy, perimeter, blast radius' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export const CTA_NAV = { label: 'Book a Demo', href: '/contact' };
export const TRIAL_CTA = {
  label: 'Start Free Trial',
  href: 'https://aws.amazon.com/marketplace/pp/prodview-kmlldyula7axs?sr=0-1&ref_=beagle&applicationId=AWSMPContessa',
};
