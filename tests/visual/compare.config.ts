export const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

export const URLS = [
  '/', '/main', '/about', '/contact', '/pricing', '/howitworks', '/news', '/events', '/conference',
  '/instaaccess', '/instaworkforce', '/instaaccess-use-cases', '/instaworkforce-use-cases',
  '/credential-compromise', '/cloud-zero-day-attack-solution', '/data-perimeter-on-aws',
  '/close-compliance-gap', '/fix-risks-before-pentest', '/who-really-has-access',
  '/stop-paying-for-cloud', '/walk-into-your-next-user-access-audit',
  '/blog', '/blog/a-new-era-of-preventive-cloud-security-with-aws',
  '/blog/instaworkforce-in-action-workforce-security-use-cases-and-demo-for-aws',
  '/blog/proactive-cloud-security-tackling-credential-theft-with-instasecure',
  '/blog/understanding-cloud-security-controls',
  '/blog/preventive-human-access',
  '/blog/instaworkforce',
];

export const DISMISS_SELECTORS = [
  // Common cookie banner selectors; add real ones after manual inspection
  '[aria-label="Close"]',
  'button:has-text("Accept")',
  'button:has-text("Got it")',
];
