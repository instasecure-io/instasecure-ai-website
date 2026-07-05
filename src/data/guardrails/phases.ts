export interface Phase { n: number; name: string; color: string; groups: string[] }

export const PHASES: Phase[] = [
  { n: 1, name: 'Basic Governance', color: '#4d66e0', groups: ['security_tooling_tamper_protection'] },
  { n: 2, name: 'Attack Surface Reduction', color: '#7a7fe0', groups: ['region_and_data_residency', 'network_boundaries'] },
  { n: 3, name: 'Best Practice Enforcement', color: '#22b07d', groups: ['data_protection_and_encryption'] },
  { n: 4, name: 'Advanced Attack Patterns', color: '#f59f3c', groups: ['identity_and_privilege_hardening', 'resource_tampering_protection', 'backup_and_recovery_integrity'] },
  { n: 5, name: 'Data Perimeter', color: '#ff5470', groups: ['identity_and_resource_perimeter'] },
];
