// src/data/guardrails/attack-chains.ts
// Curated attack content for the Gap Report §2 (attacker-lifecycle map) + §3 (real-adversary
// playbooks). Actors/chains/lifecycle are shared across users; per-user open/closed status is
// computed at render time from the attested set (see assess.ts).
//
// Technique/tactic values are locked to the control catalog's ATT&CK v19.1 `attack[]`/`tactics[]`
// fields (see the cross-integrity test); controls.ts is the source of truth for any control-bearing
// entry.

export type Sev = 'critical' | 'high' | 'medium' | 'low';

export interface PlaybookStep {
  label: string;
  api: string;
  technique: string;
  techniqueName: string;
  tactic: string;
  control: string | null;
  controlName: string | null;
  sev: Sev | null;
  partial?: boolean;
}

export interface ActorMeta {
  id: string;
  name: string;
  flagship: boolean;
  aliases: string;
  mitreGroup: string | null;
  mitreUrl: string | null;
  premise: string;
  sources: { name: string; url: string; date: string }[];
}

export interface LifecycleTactic {
  tactic: string;
  populated: boolean;
  controls: { control: string; controlName: string; technique: string }[];
}

export const ACTORS: Record<string, ActorMeta> = {
  'scattered-spider': {
    id: 'scattered-spider',
    name: 'Scattered Spider',
    flagship: true,
    aliases: 'UNC3944 · Octo Tempest · Muddled Libra · 0ktapus · Scatter Swine · Storm-0875',
    mitreGroup: 'G1015',
    mitreUrl: 'https://attack.mitre.org/groups/G1015/',
    premise: 'Social-engineer the help desk into a valid identity, then live in the cloud console.',
    sources: [
      { name: 'CISA advisory AA23-320A', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a', date: '29 Jul 2025' },
      { name: 'Permiso — LUCR-3', url: 'https://permiso.io/blog/lucr-3-scattered-spider-getting-saas-y-in-the-cloud', date: '2023' },
    ],
  },
  'storm-0501': {
    id: 'storm-0501',
    name: 'Storm-0501',
    flagship: false,
    aliases: '',
    mitreGroup: null,
    mitreUrl: null,
    premise: 'Skip the malware — exfiltrate, then destroy recovery and ransom with the cloud’s own tools.',
    sources: [
      { name: 'Microsoft Threat Intelligence', url: 'https://www.microsoft.com/en-us/security/blog/2025/08/27/storm-0501s-evolving-techniques-lead-to-cloud-based-ransomware/', date: '27 Aug 2025' },
      { name: 'Codefinger (S3 SSE-C)', url: 'https://www.helpnetsecurity.com/2025/01/13/codefinger-encrypting-aws-s3-data-without-ransomware-sse-c/', date: '13 Jan 2025' },
    ],
  },
  'scarleteel': {
    id: 'scarleteel',
    name: 'SCARLETEEL',
    flagship: false,
    aliases: '',
    mitreGroup: null,
    mitreUrl: null,
    premise: 'Pop a container, pivot to AWS creds, quietly carry the data out — and mine on the way.',
    sources: [
      { name: 'Sysdig Threat Research', url: 'https://www.sysdig.com/blog/cloud-breach-terraform-data-theft', date: '2023' },
    ],
  },
};

export const CHAINS: { id: string; steps: PlaybookStep[] }[] = [
  {
    id: 'scattered-spider',
    steps: [
      { label: 'Ride a valid identity in', api: 'valid creds + MFA bypass (SIM-swap, push-fatigue, AiTM)', technique: 'T1078.004', techniqueName: 'Valid Accounts: Cloud Accounts', tactic: 'Initial Access', control: 'IS-PERIMETER-PV-16', controlName: 'Restrict IAM user credentials to trusted networks', sev: 'high' },
      { label: 'Pull secrets & IaC state', api: 'SecretsManager / Terraform via CloudShell', technique: 'T1537', techniqueName: 'Transfer Data to Cloud Account', tactic: 'Exfiltration', control: 'IS-PERIMETER-PV-1', controlName: 'Identity perimeter — deny non-org principals on org resources', sev: 'high', partial: true },
      { label: 'Enumerate the estate', api: 'SSM AWS-GatherSoftwareInventory, S3 Browser', technique: 'T1526', techniqueName: 'Cloud Service Discovery', tactic: 'Discovery', control: null, controlName: null, sev: null },
      { label: 'Plant IAM persistence', api: 'CreateUser + CreateAccessKey + UpdateLoginProfile', technique: 'T1098.001', techniqueName: 'Account Manipulation: Additional Cloud Credentials', tactic: 'Persistence', control: 'IS-IAM-PV-9', controlName: 'Restrict IAM user lifecycle and credential management to privileged principals', sev: 'high' },
      { label: 'Backdoor the identity provider', api: 'modify federation trust + register rogue MFA', technique: 'T1556', techniqueName: 'Modify Authentication Process', tactic: 'Persistence', control: 'IS-IAM-PV-6', controlName: 'Restrict modifications to identity provider trust configurations', sev: 'critical' },
      { label: 'Swap the instance role', api: 'ReplaceIamInstanceProfileAssociation', technique: 'T1098.003', techniqueName: 'Account Manipulation: Additional Cloud Roles', tactic: 'Privilege Escalation', control: null, controlName: null, sev: null },
      { label: 'Blind the sensors', api: 'DeleteTrail / StopLogging; GuardDuty DeleteDetector / DisassociateFromMasterAccount', technique: 'T1685', techniqueName: 'Disable or Modify Tools', tactic: 'Defense Impairment', control: 'IS-GUARDDUTY-PV-1', controlName: 'Deny disabling Amazon GuardDuty or modifying its configuration', sev: 'critical' },
      { label: 'Open a serial backdoor', api: 'EnableSerialConsoleAccess + SendSerialConsoleSSHPublicKey', technique: 'T1563', techniqueName: 'Remote Service Session Hijacking', tactic: 'Lateral Movement', control: null, controlName: null, sev: null },
      { label: 'Exfil to their own account', api: 'S3 Browser → adversary S3; RDS/DynamoDB', technique: 'T1537', techniqueName: 'Transfer Data to Cloud Account', tactic: 'Exfiltration', control: 'IS-PERIMETER-PV-9', controlName: 'Resource perimeter — restrict org principals to trusted resources', sev: 'high' },
    ],
  },
  {
    id: 'storm-0501',
    steps: [
      { label: 'Exfiltrate at scale', api: 'bulk copy to attacker storage', technique: 'T1537', techniqueName: 'Transfer Data to Cloud Account', tactic: 'Exfiltration', control: 'IS-PERIMETER-PV-9', controlName: 'Resource perimeter — restrict org principals to trusted resources', sev: 'high' },
      { label: 'Destroy data & backups', api: 'delete snapshots / restore points / vaults', technique: 'T1490', techniqueName: 'Inhibit System Recovery', tactic: 'Impact', control: 'IS-BACKUP-PV-5', controlName: 'Disallow deletion and configuration changes to AWS Backup resources', sev: 'critical' },
      { label: 'Lock with attacker-held keys', api: 'own key vault, then delete keys', technique: 'T1486', techniqueName: 'Data Encrypted for Impact', tactic: 'Impact', control: 'IS-KMS-PV-8', controlName: 'Enforce minimum 30-day cooldown for KMS key deletion', sev: 'high' },
    ],
  },
  {
    id: 'scarleteel',
    steps: [
      { label: 'Disable CloudTrail', api: 'StopLogging + --endpoint-url dodge', technique: 'T1685.002', techniqueName: 'Disable or Modify Cloud Log', tactic: 'Defense Impairment', control: 'IS-CT-PV-1', controlName: 'Disallow configuration changes to AWS CloudTrail trails', sev: 'critical' },
      { label: 'Copy data cross-account', api: 'instance-role → foreign S3', technique: 'T1537', techniqueName: 'Transfer Data to Cloud Account', tactic: 'Exfiltration', control: 'IS-PERIMETER-PV-9', controlName: 'Resource perimeter — restrict org principals to trusted resources', sev: 'high' },
      { label: 'Spin up mining compute', api: 'GPU instances in unused region', technique: 'T1496', techniqueName: 'Resource Hijacking', tactic: 'Impact', control: 'IS-REGION-PV-1', controlName: 'Deny actions outside approved AWS Regions', sev: 'medium' },
    ],
  },
];

// Attacker lifecycle — all 12 ATT&CK v19.1 (IaaS) tactics in order. populated:false means the
// catalog maps no preventive control to that tactic (detection territory), not "pending". The
// controls shown per tactic are a representative curation; per-tactic catalog totals are larger
// (control-knowledge-base references/attack_coverage.json). Kept in sync by attack-chains.test.ts.
export const LIFECYCLE: LifecycleTactic[] = [
  { tactic: 'Initial Access', populated: true, controls: [
    { control: 'IS-PERIMETER-PV-16', controlName: 'Restrict IAM user credentials to trusted networks', technique: 'T1078.004' },
    { control: 'IS-LAMBDA-PV-2', controlName: 'Require AWS Lambda function URLs to use IAM authentication', technique: 'T1190' },
  ] },
  { tactic: 'Execution', populated: true, controls: [
    { control: 'IS-IAM-PV-8', controlName: 'Restrict AWS CLI login with console credentials to privileged roles', technique: 'T1059.009' },
    { control: 'IS-NETWORK-PV-4', controlName: 'Enforce VPC deployment for compute and ML services', technique: 'T1651' },
    { control: 'IS-ECR-PV-1', controlName: 'Enforce identity and resource perimeter on ECR API VPC endpoint', technique: 'T1204.003' },
  ] },
  { tactic: 'Persistence', populated: true, controls: [
    { control: 'IS-IAM-PV-9', controlName: 'Restrict IAM user lifecycle and credential management to privileged principals', technique: 'T1098.001' },
    { control: 'IS-IAM-PV-6', controlName: 'Restrict modifications to identity provider trust configurations', technique: 'T1556' },
    { control: 'IS-IAM-PV-12', controlName: 'Disallow creation or modification of IAM SAML/OIDC federation providers', technique: 'T1556' },
    { control: 'IS-BEDROCK-PV-3', controlName: 'Disallow Amazon Bedrock invocations using long-term API keys', technique: 'T1078.004' },
  ] },
  { tactic: 'Privilege Escalation', populated: true, controls: [
    { control: 'IS-IAM-PV-10', controlName: 'Protect designated privileged IAM roles from modification or assumption', technique: 'T1098.003' },
    { control: 'IS-IAM-PV-5', controlName: 'Prevent root credentials management in member accounts', technique: 'T1078.004' },
  ] },
  { tactic: 'Defense Impairment', populated: true, controls: [
    { control: 'IS-CT-PV-1', controlName: 'Disallow configuration changes to AWS CloudTrail trails', technique: 'T1685.002' },
    { control: 'IS-GUARDDUTY-PV-1', controlName: 'Deny disabling Amazon GuardDuty or modifying its configuration', technique: 'T1685' },
    { control: 'IS-ORG-PV-1', controlName: 'Deny member accounts from leaving the AWS Organization', technique: 'T1666' },
  ] },
  { tactic: 'Stealth', populated: true, controls: [
    { control: 'IS-REGION-PV-2', controlName: 'Restrict opt-in AWS Region enable/disable to a privileged role', technique: 'T1535' },
    { control: 'IS-GLUE-PV-1', controlName: 'Enforce network perimeter on AWS Glue service roles', technique: 'T1535' },
  ] },
  { tactic: 'Credential Access', populated: true, controls: [
    { control: 'IS-PERIMETER-PV-2', controlName: 'Network perimeter (SourceVPC) — deny resource access outside expected VPCs', technique: 'T1555.006' },
    { control: 'IS-IAM-PV-7', controlName: 'Deny SAML provider changes for AWS IAM Identity Center', technique: 'T1556' },
    { control: 'IS-IAM-PV-12', controlName: 'Disallow creation or modification of IAM SAML/OIDC federation providers', technique: 'T1556' },
  ] },
  { tactic: 'Discovery', populated: false, controls: [] },
  { tactic: 'Lateral Movement', populated: true, controls: [
    { control: 'IS-PERIMETER-PV-11', controlName: 'Network perimeter — bind EC2 instance role usage to expected networks', technique: 'T1550.001' },
    { control: 'IS-NETWORK-PV-3', controlName: 'Disallow VPN connections to Amazon VPCs', technique: 'T1021' },
    { control: 'IS-PERIMETER-PV-16', controlName: 'Restrict IAM user credentials to trusted networks', technique: 'T1021.007' },
  ] },
  { tactic: 'Collection', populated: true, controls: [
    { control: 'IS-EBS-PV-1', controlName: 'Disallow use of Amazon EBS direct APIs', technique: 'T1530' },
    { control: 'IS-EC2-PV-2', controlName: 'Require encryption on attached Amazon EBS volumes', technique: 'T1530' },
    { control: 'IS-S3-PV-5', controlName: 'Disallow modifications to audit S3 bucket policies', technique: 'T1530' },
  ] },
  { tactic: 'Exfiltration', populated: true, controls: [
    { control: 'IS-PERIMETER-PV-9', controlName: 'Resource perimeter — restrict org principals to trusted resources', technique: 'T1537' },
    { control: 'IS-PERIMETER-PV-12', controlName: 'Prevent service-issued S3 presigned URLs that bypass the network perimeter', technique: 'T1048' },
    { control: 'IS-RAM-PV-1', controlName: 'Deny AWS RAM resource shares to external accounts', technique: 'T1537' },
    { control: 'IS-EC2-PV-3', controlName: 'Disallow public sharing of EBS snapshots', technique: 'T1537' },
  ] },
  { tactic: 'Impact', populated: true, controls: [
    { control: 'IS-BACKUP-PV-5', controlName: 'Disallow deletion and configuration changes to AWS Backup resources', technique: 'T1490' },
    { control: 'IS-KMS-PV-8', controlName: 'Enforce minimum 30-day cooldown for KMS key deletion', technique: 'T1486' },
    { control: 'IS-REGION-PV-1', controlName: 'Deny actions outside approved AWS Regions', technique: 'T1496' },
  ] },
];
