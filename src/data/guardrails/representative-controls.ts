// src/data/guardrails/representative-controls.ts
// PUBLIC representative sample of InstaSecure guardrails — the controls named in the §2/§3
// attack showcase, the assessment sample sections, and the challenge game. A deliberate subset
// (~33 of 122); the full catalog is private IP. Never expand this to the whole catalog.
export interface RepControl { id: string; name: string; sev: "critical" | "high" | "medium" | "low"; tier: "mandatory" | "strongly_recommended" | "elective"; group: string }
export const REPRESENTATIVE_CONTROLS: RepControl[] = [
  {
    "id": "IS-BACKUP-PV-5",
    "name": "Disallow deletion and configuration changes to AWS Backup resources",
    "sev": "critical",
    "tier": "mandatory",
    "group": "backup_and_recovery_integrity"
  },
  {
    "id": "IS-BEDROCK-PV-1",
    "name": "Disallow Amazon Bedrock API key credentials and bearer-token calls",
    "sev": "medium",
    "tier": "elective",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-BEDROCK-PV-3",
    "name": "Disallow Amazon Bedrock invocations using long-term API keys",
    "sev": "medium",
    "tier": "elective",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-BEDROCK-PV-4",
    "name": "Restrict Amazon Bedrock model invocation to approved foundation models",
    "sev": "medium",
    "tier": "elective",
    "group": "resource_tampering_protection"
  },
  {
    "id": "IS-CT-PV-1",
    "name": "Disallow configuration changes to AWS CloudTrail trails",
    "sev": "critical",
    "tier": "mandatory",
    "group": "security_tooling_tamper_protection"
  },
  {
    "id": "IS-EBS-PV-1",
    "name": "Disallow use of Amazon EBS direct APIs",
    "sev": "high",
    "tier": "elective",
    "group": "data_protection_and_encryption"
  },
  {
    "id": "IS-EC2-PV-2",
    "name": "Require encryption on attached Amazon EBS volumes",
    "sev": "high",
    "tier": "elective",
    "group": "data_protection_and_encryption"
  },
  {
    "id": "IS-EC2-PV-3",
    "name": "Disallow public sharing of EBS snapshots",
    "sev": "critical",
    "tier": "elective",
    "group": "data_protection_and_encryption"
  },
  {
    "id": "IS-ECR-PV-1",
    "name": "Enforce identity and resource perimeter on ECR API VPC endpoint",
    "sev": "medium",
    "tier": "elective",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-GLUE-PV-1",
    "name": "Enforce network perimeter on AWS Glue service roles",
    "sev": "high",
    "tier": "elective",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-GUARDDUTY-PV-1",
    "name": "Deny disabling Amazon GuardDuty or modifying its configuration",
    "sev": "critical",
    "tier": "strongly_recommended",
    "group": "security_tooling_tamper_protection"
  },
  {
    "id": "IS-IAM-PV-10",
    "name": "Protect designated privileged IAM roles from modification or assumption",
    "sev": "critical",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-IAM-PV-12",
    "name": "Disallow creation or modification of IAM SAML/OIDC federation providers",
    "sev": "critical",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-IAM-PV-5",
    "name": "Prevent root credentials management in member accounts",
    "sev": "critical",
    "tier": "mandatory",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-IAM-PV-6",
    "name": "Restrict modifications to identity provider trust configurations",
    "sev": "critical",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-IAM-PV-7",
    "name": "Deny SAML provider changes for AWS IAM Identity Center",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-IAM-PV-8",
    "name": "Restrict AWS CLI login with console credentials to privileged roles",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-IAM-PV-9",
    "name": "Restrict IAM user lifecycle and credential management to privileged principals",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-KMS-PV-8",
    "name": "Enforce minimum 30-day cooldown for KMS key deletion",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "data_protection_and_encryption"
  },
  {
    "id": "IS-LAMBDA-PV-2",
    "name": "Require AWS Lambda function URLs to use IAM authentication",
    "sev": "critical",
    "tier": "elective",
    "group": "data_protection_and_encryption"
  },
  {
    "id": "IS-NETWORK-PV-3",
    "name": "Disallow VPN connections to Amazon VPCs",
    "sev": "medium",
    "tier": "elective",
    "group": "network_boundaries"
  },
  {
    "id": "IS-NETWORK-PV-4",
    "name": "Enforce VPC deployment for compute and ML services",
    "sev": "high",
    "tier": "elective",
    "group": "network_boundaries"
  },
  {
    "id": "IS-ORG-PV-1",
    "name": "Deny member accounts from leaving the AWS Organization",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_privilege_hardening"
  },
  {
    "id": "IS-PERIMETER-PV-1",
    "name": "Identity perimeter — deny non-org principals on org resources",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-PERIMETER-PV-11",
    "name": "Network perimeter — bind EC2 instance role usage to expected networks",
    "sev": "high",
    "tier": "elective",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-PERIMETER-PV-12",
    "name": "Prevent service-issued S3 presigned URLs that bypass the network perimeter",
    "sev": "medium",
    "tier": "elective",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-PERIMETER-PV-16",
    "name": "Restrict IAM user credentials to trusted networks",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-PERIMETER-PV-2",
    "name": "Network perimeter (SourceVPC) — deny resource access outside expected VPCs",
    "sev": "high",
    "tier": "elective",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-PERIMETER-PV-4",
    "name": "Network perimeter (VpceOrgID) — deny resource access from unexpected networks",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-PERIMETER-PV-9",
    "name": "Resource perimeter — restrict org principals to trusted resources",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-RAM-PV-1",
    "name": "Deny AWS RAM resource shares to external accounts",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "identity_and_resource_perimeter"
  },
  {
    "id": "IS-REGION-PV-1",
    "name": "Deny actions outside approved AWS Regions",
    "sev": "medium",
    "tier": "elective",
    "group": "region_and_data_residency"
  },
  {
    "id": "IS-REGION-PV-2",
    "name": "Restrict opt-in AWS Region enable/disable to a privileged role",
    "sev": "high",
    "tier": "strongly_recommended",
    "group": "region_and_data_residency"
  },
  {
    "id": "IS-S3-PV-5",
    "name": "Disallow modifications to audit S3 bucket policies",
    "sev": "high",
    "tier": "elective",
    "group": "security_tooling_tamper_protection"
  }
];
