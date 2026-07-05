export interface FrameworkRef { key: string; label: string }

export const CURATED_FRAMEWORKS: FrameworkRef[] = [
  { key: 'SSAE-18-SOC-2-Oct-2023', label: 'SOC 2' },
  { key: 'PCI 4.0', label: 'PCI DSS 4.0' },
  { key: 'ISO 27001', label: 'ISO 27001' },
  { key: 'FedRAMP', label: 'FedRAMP' },
  { key: 'NIST 800-53', label: 'NIST 800-53' },
  { key: 'NIST 800-171', label: 'NIST 800-171' },
  { key: 'CIS-v8.0', label: 'CIS v8' },
  { key: 'NIST-CSF-v1.1', label: 'NIST CSF' },
];
