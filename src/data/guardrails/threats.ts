export interface Threat { label: string; color: string }

export const THREATS: Record<string, Threat> = {
  'compromised-credential': { label: 'Compromised Credential', color: '#ff5470' },
  'insider-threat': { label: 'Insider Threat', color: '#b95ad8' },
  'data-exfiltration': { label: 'Data Exfiltration', color: '#f59f3c' },
  'policy-bypass': { label: 'Policy Bypass', color: '#4d66e0' },
  'misconfiguration': { label: 'Misconfiguration', color: '#22b07d' },
};
