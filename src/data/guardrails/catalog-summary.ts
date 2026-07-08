// src/data/guardrails/catalog-summary.ts
// PUBLIC aggregate skeleton of the InstaSecure control catalog — safe to ship/commit.
// Per-group counts + severity weights + per-tactic counts drive the *estimate* assessment
// and the \"…and N more\" framing. The full 122-control catalog (names, policies, mappings)
// is private IP (src/data/guardrails/controls.ts is gitignored; regenerate from the KB).
export interface CatalogGroup { count: number; weight: number; mandatory: number }
export interface CatalogSummary {
  total: number;
  groups: Record<string, CatalogGroup>;
  phaseWeight: Record<string, number>;
  tactics: Record<string, number>;
  aiTotal: number;
  auditTamperTotal: number;
  mandatoryTotal: number;
  frameworks: Record<string, number>;
}
export const CATALOG: CatalogSummary = {
  "total": 122,
  "groups": {
    "security_tooling_tamper_protection": {
      "count": 23,
      "weight": 83,
      "mandatory": 14
    },
    "identity_and_resource_perimeter": {
      "count": 29,
      "weight": 73,
      "mandatory": 0
    },
    "network_boundaries": {
      "count": 6,
      "weight": 14,
      "mandatory": 0
    },
    "backup_and_recovery_integrity": {
      "count": 5,
      "weight": 20,
      "mandatory": 1
    },
    "identity_and_privilege_hardening": {
      "count": 24,
      "weight": 75,
      "mandatory": 2
    },
    "resource_tampering_protection": {
      "count": 10,
      "weight": 22,
      "mandatory": 0
    },
    "data_protection_and_encryption": {
      "count": 17,
      "weight": 53,
      "mandatory": 0
    },
    "region_and_data_residency": {
      "count": 8,
      "weight": 20,
      "mandatory": 0
    }
  },
  "phaseWeight": {
    "1": 83,
    "2": 34,
    "3": 53,
    "4": 117,
    "5": 73
  },
  "tactics": {
    "Defense Impairment": 38,
    "Exfiltration": 36,
    "Initial Access": 19,
    "Impact": 31,
    "Persistence": 27,
    "Lateral Movement": 5,
    "Collection": 7,
    "Execution": 4,
    "Stealth": 3,
    "Privilege Escalation": 18,
    "Credential Access": 5
  },
  "aiTotal": 4,
  "auditTamperTotal": 25,
  "mandatoryTotal": 17,
  "frameworks": {
    "SSAE-18-SOC-2-Oct-2023": 20,
    "PCI-DSS-v4.0": 21,
    "ISO-IEC-27001:2013-Annex-A": 23,
    "FedRAMP-r4": 23,
    "NIST-SP-800-53-r5": 23,
    "NIST-SP-800-171-r2": 23,
    "CIS-v8.0": 15,
    "NIST-CSF-v1.1": 18
  }
};
