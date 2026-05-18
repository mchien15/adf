#!/usr/bin/env node
/**
 * Update Codex session state with new active plan
 *
 * Usage: node .codex/scripts/set-active-plan-codex.cjs <plan-path>
 */

'use strict';

const path = require('path');
const {
  readSessionState,
  writeSessionState,
} = require('../../.agents/hooks/lib/ck-config-utils.cjs');

const sessionId = process.env.CODEX_THREAD_ID || process.env.CK_SESSION_ID || null;
const newPlan = process.argv[2];

if (!newPlan) {
  console.error('Error: Plan path required');
  console.log('Usage: node .codex/scripts/set-active-plan-codex.cjs <plan-path>');
  console.log('Example: node .codex/scripts/set-active-plan-codex.cjs plans/251207-1030-feature-name');
  process.exit(1);
}

const current = sessionId ? (readSessionState(sessionId) || {}) : {};
const planBaseDir = current.sessionOrigin || process.cwd();
const absolutePlan = path.isAbsolute(newPlan)
  ? newPlan
  : path.resolve(planBaseDir, newPlan);

if (!sessionId) {
  console.warn('Warning: CODEX_THREAD_ID not set - session state will not persist');
  console.log(`Would set active plan to: ${absolutePlan}`);
  process.exit(0);
}

const success = writeSessionState(sessionId, {
  ...current,
  sessionOrigin: planBaseDir,
  activePlan: absolutePlan,
  suggestedPlan: null,
  timestamp: Date.now(),
  source: 'codex',
});

if (success) {
  console.log(`Active plan set to: ${absolutePlan}`);
} else {
  console.error('Failed to update Codex session state');
  process.exit(1);
}
