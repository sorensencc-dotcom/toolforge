#!/usr/bin/env node
/**
 * scripts/scaffold-statechart.mjs
 * 
 * Intertwines Trail Code AST indexing with Statechart (TLA+/TLC) modeling:
 * 1. Skims candidate state machines from code or user-provided state names.
 * 2. Generates standard TLA+ specification (.tla), config (.cfg), and visual view module (.mjs).
 * 3. Optionally runs `statechart` to verify invariants and output Mermaid state charts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function getFlag(name, defaultValue = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const hasFlag = (name) => args.includes(`--${name}`);

const targetFile = args.find((a) => !a.startsWith('--'));
const name = getFlag('name', targetFile ? path.basename(targetFile).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '') : 'StateMachine');
const outDir = getFlag('out', path.resolve(process.cwd(), `${name}-spec`));
const shouldRun = hasFlag('run') || hasFlag('check');

let rawStates = getFlag('states');
let rawActions = getFlag('actions');
let rawInvariants = getFlag('invariants');

// If a target source file is given, attempt basic AST / string scan to discover states
if (targetFile && fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  
  if (!rawStates) {
    const statusMatches = content.match(/status\s*[:=]\s*['"]([A-Z0-9_]+)['"]/gi) || [];
    const extracted = [...new Set(statusMatches.map(m => m.split(/[:=]/)[1].trim().replace(/['"]/g, '')))];
    if (extracted.length > 1) {
      rawStates = extracted.join(',');
    }
  }

  if (!rawActions) {
    const fnMatches = content.match(/function\s+([a-zA-Z0-9_]+)|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g) || [];
    const extractedFns = [...new Set(fnMatches.map(m => m.replace(/function|\s*\{|\s*\([^)]*\)/g, '').trim()))]
      .filter(f => f && !['constructor', 'toString', 'if', 'for', 'while', 'catch'].includes(f))
      .slice(0, 6);
    if (extractedFns.length > 1) {
      rawActions = extractedFns.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(',');
    }
  }
}

const states = (rawStates || 'IDLE,PROCESSING,COMPLETED,FAILED').split(',').map(s => s.trim()).filter(Boolean);
const actions = (rawActions || 'Start,Step,Success,Fail,Reset').split(',').map(a => a.trim()).filter(Boolean);
const invariants = (rawInvariants || 'TypeOK').split(',').map(i => i.trim()).filter(Boolean);

fs.mkdirSync(outDir, { recursive: true });

// 1. Generate TLA+ Spec
const statesSet = `{"${states.join('", "')}"}`;
const actionDefs = actions.map((act, i) => {
  const nextState = states[(i + 1) % states.length];
  return `${act} ==\n  /\\ state \\in ${statesSet}\n  /\\ state' = "${nextState}"\n  /\\ UNCHANGED <<retries>>`;
}).join('\n\n');

const nextDisjunction = actions.join(' \\/ ');

const tlaContent = `-------------------------------- MODULE ${name} --------------------------------
EXTENDS Naturals

VARIABLE state, retries

vars == <<state, retries>>

States == ${statesSet}

Init ==
  /\\ state = "${states[0]}"
  /\\ retries = 0

TypeOK ==
  /\\ state \\in States
  /\\ retries \\in Nat

${actionDefs}

Next ==
  ${nextDisjunction}

Spec == Init /\\ [][Next]_vars
=============================================================================
`;

const tlaPath = path.join(outDir, `${name}.tla`);
fs.writeFileSync(tlaPath, tlaContent, 'utf8');

// 2. Generate TLC Config
const cfgContent = `SPECIFICATION Spec
CHECK_DEADLOCK FALSE
INVARIANT TypeOK
`;
const cfgPath = path.join(outDir, `${name}.cfg`);
fs.writeFileSync(cfgPath, cfgContent, 'utf8');

// 3. Generate Visual View Module
const viewContent = `/**
 * Visual translation view for ${name}
 */
export const title = "${name} State Graph";

export const state = (vars) => {
  return String(vars.state || "Unknown");
};

export const step = (action, from, to) => {
  return action || "transition";
};

export const colors = {
  active: "blue",
  success: "teal",
  failed: "pink"
};
`;
const viewPath = path.join(outDir, `${name}View.mjs`);
fs.writeFileSync(viewPath, viewContent, 'utf8');

console.log(`[Scaffold-Statechart] Generated TLA+ specification package for ${name}:`);
console.log(`  - Spec:   ${tlaPath}`);
console.log(`  - Config: ${cfgPath}`);
console.log(`  - View:   ${viewPath}`);

if (shouldRun) {
  console.log(`\n[Scaffold-Statechart] Executing statechart model checker...`);
  const chartOutDir = path.join(outDir, 'chart');
  try {
    const statechartScript = path.resolve(process.env.USERPROFILE, '.agents/skills/statechart/scripts/statechart.ts');
    const res = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', statechartScript, tlaPath, '--config', cfgPath, '--view', viewPath, '--out', chartOutDir], {
      stdio: 'inherit'
    });
    if (res.status === 0 || res.status === 1) {
      const chartPath = path.join(chartOutDir, 'chart.mmd');
      if (fs.existsSync(chartPath)) {
        console.log(`\n--- Generated Mermaid Chart (${chartPath}) ---`);
        console.log(fs.readFileSync(chartPath, 'utf8'));
      }
    }
  } catch (err) {
    console.error(`Failed to execute statechart:`, err.message);
  }
}
