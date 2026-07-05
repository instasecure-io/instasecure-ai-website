export interface GroupMeta { label: string; short: string; phase: number; blurb: string }

export const GROUPS: Record<string, GroupMeta> = {
  security_tooling_tamper_protection: { label: 'Security Tooling Tamper Protection', short: 'Tamper Protection', phase: 1, blurb: 'Protect the integrity of monitoring and logging — CloudTrail, GuardDuty, Config, Security Hub can never be silenced.' },
  region_and_data_residency: { label: 'Region & Data Residency', short: 'Region Control', phase: 2, blurb: 'Constrain WHERE actions can happen — region allow-lists, data residency, sovereignty.' },
  network_boundaries: { label: 'Network Boundaries', short: 'Network', phase: 2, blurb: 'Enforce network isolation — VPCs, peering, internet gateways, VPN, egress.' },
  data_protection_and_encryption: { label: 'Data Protection & Encryption', short: 'Data Protection', phase: 3, blurb: 'Enforce encryption at rest and in transit; shut down public data exposure by default.' },
  identity_and_privilege_hardening: { label: 'Identity & Privilege Hardening', short: 'Identity', phase: 4, blurb: 'Restrict what principals can do — no privilege escalation, no root, no rogue IAM mutations.' },
  resource_tampering_protection: { label: 'Resource Tampering Protection', short: 'Resource Protection', phase: 4, blurb: 'Prevent destructive modification or deletion of critical resources.' },
  backup_and_recovery_integrity: { label: 'Backup & Recovery Integrity', short: 'Backup', phase: 4, blurb: 'Protect backups and recovery points — the last line against ransomware.' },
  identity_and_resource_perimeter: { label: 'Identity & Resource Perimeter', short: 'Perimeter', phase: 5, blurb: 'Only trusted identities, from trusted networks, touching trusted resources.' },
};
