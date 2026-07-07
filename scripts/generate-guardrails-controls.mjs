#!/usr/bin/env node
// Regenerates src/data/guardrails/controls.ts from a local checkout of
// instasecure-io/control-knowledge-base. Selection and field mapping mirror
// the catalog's projection contract (control-knowledge-base
// docs/superpowers/specs/2026-07-06-attack-downstream-propagation-design.md §5):
//   include: human_review_status ∈ {approved, edited} AND verdict != duplicate_of
//   overlay: human_edits[field].human_value
//   gate:    attack/tactics only when attack_review_status ∈ {approved, edited}
// Usage: node scripts/generate-guardrails-controls.mjs --kb-path /path/to/control-knowledge-base
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const kbFlag = args.indexOf('--kb-path');
if (kbFlag === -1 || !args[kbFlag + 1]) {
  console.error('usage: generate-guardrails-controls.mjs --kb-path <control-knowledge-base checkout>');
  process.exit(2);
}
const kbPath = args[kbFlag + 1];
const manifestPath = join(kbPath, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`error: ${manifestPath} not found — is --kb-path a control-knowledge-base checkout?`);
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const REVIEWED = new Set(['approved', 'edited']);

function overlayHumanEdits(suggested, humanEdits) {
  const merged = { ...suggested };
  for (const [field, edit] of Object.entries(humanEdits ?? {})) {
    if (edit && typeof edit === 'object' && 'human_value' in edit) merged[field] = edit.human_value;
  }
  return merged;
}

const controls = [];
for (const slug of Object.keys(manifest.controls).sort()) {
  const clsPath = join(kbPath, slug, 'classification.json');
  if (!existsSync(clsPath)) continue;
  const cls = JSON.parse(readFileSync(clsPath, 'utf8'));
  if (!REVIEWED.has(cls.human_review_status)) continue;
  if (cls.verdict === 'duplicate_of') continue;
  const m = overlayHumanEdits(cls.suggested_metadata ?? {}, cls.human_edits);
  const attackReviewed = REVIEWED.has(cls.attack_review_status);
  controls.push({
    id: m.id,
    name: m.name,
    desc: m.description,
    group: m.grouping,
    objective: m.objective,
    sev: m.severity,
    tier: m.guidance_tier,
    impl: m.implementation,
    scope: m.resource_scope,
    service: m.primary_service ?? null,
    tags: m.intent_tags ?? [],
    threats: m.threat_classes ?? [],
    fw: m.frameworks ?? [],
    attack: attackReviewed ? (m.attack_techniques ?? []) : [],
    tactics: attackReviewed ? (m.attack_tactics ?? []) : [],
  });
}
controls.sort((a, b) => a.id.localeCompare(b.id));

if (controls.length === 0) {
  console.error('error: selected 0 controls — refusing to write an empty catalog');
  process.exit(1);
}

let shortSha = 'unknown';
try {
  shortSha = execSync('git rev-parse --short HEAD', { cwd: kbPath, encoding: 'utf8' }).trim();
} catch { /* provenance is informational */ }

const header = `// src/data/guardrails/controls.ts
// GENERATED from instasecure-io/control-knowledge-base @ ${shortSha} by scripts/generate-guardrails-controls.mjs — do not hand-edit.
// ${controls.length} canonical AWS preventive controls (human-reviewed only; attack/tactics carry ATT&CK v19.1 data
// and are empty unless the control's attack_review_status is approved/edited).
export interface Control {
  id: string; name: string; desc: string; group: string; objective: string;
  sev: "critical" | "high" | "medium" | "low";
  tier: "mandatory" | "strongly_recommended" | "elective";
  impl: string; scope: string; service: string | null;
  tags: string[]; threats: string[]; fw: string[];
  attack: string[]; tactics: string[];
}

export const CONTROLS: Control[] = `;

writeFileSync(
  new URL('../src/data/guardrails/controls.ts', import.meta.url),
  header + JSON.stringify(controls, null, 2) + ';\n',
);
console.log(`wrote src/data/guardrails/controls.ts: ${controls.length} controls from KB @ ${shortSha}`);
