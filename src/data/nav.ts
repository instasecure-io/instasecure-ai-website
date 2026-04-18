export interface NavItem { label: string; href: string; children?: NavItem[]; }

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Products', href: '#', children: [
    { label: 'InstaAccess', href: '/instaaccess' },
    { label: 'InstaWorkforce', href: '/instaworkforce' },
  ]},
  { label: 'Use Cases', href: '#', children: [
    { label: 'Credential Compromise', href: '/credential-compromise' },
    { label: 'Cloud Zero-Day', href: '/cloud-zero-day-attack-solution' },
    { label: 'Data Perimeter on AWS', href: '/data-perimeter-on-aws' },
    { label: 'Close Compliance Gap', href: '/close-compliance-gap' },
    { label: 'Fix Risks Before Pentest', href: '/fix-risks-before-pentest' },
    { label: 'Who Really Has Access', href: '/who-really-has-access' },
    { label: 'Stop Paying for Cloud', href: '/stop-paying-for-cloud' },
    { label: 'Walk Into Your Next Audit', href: '/walk-into-your-next-user-access-audit' },
  ]},
  { label: 'How It Works', href: '/howitworks' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export const CTA_NAV = { label: 'Book a Demo', href: '/contact' };
