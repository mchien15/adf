#!/usr/bin/env node
/**
 * dev-rules-reminder-codex.cjs - Codex UserPromptSubmit hook
 *
 * Injects dev rules reminder into every prompt (with debounce to avoid spam).
 * Reads stdin JSON: { session_id, transcript_path?, ... }
 * Outputs JSON: { systemMessage: "..." }
 * Exit 0 always (non-blocking).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Debounce ─────────────────────────────────────────────────────────────────

// Minimum minutes between injections per session (avoids spamming every turn)
const DEBOUNCE_MINUTES = 10;

/**
 * Check if we recently injected a reminder for this session.
 * Uses a temp file keyed by session_id.
 *
 * @param {string|undefined} sessionId
 * @returns {boolean} true if injected recently (should skip)
 */
function wasRecentlyInjected(sessionId) {
  if (!sessionId) return false;
  const stateFile = path.join(os.tmpdir(), `codex-rules-reminder-${sessionId}.json`);
  try {
    if (!fs.existsSync(stateFile)) return false;
    const { lastInjected } = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const elapsedMin = (Date.now() - lastInjected) / 60000;
    return elapsedMin < DEBOUNCE_MINUTES;
  } catch (_) {
    return false;
  }
}

/**
 * Record injection timestamp for this session.
 * @param {string|undefined} sessionId
 */
function recordInjection(sessionId) {
  if (!sessionId) return;
  const stateFile = path.join(os.tmpdir(), `codex-rules-reminder-${sessionId}.json`);
  try {
    fs.writeFileSync(stateFile, JSON.stringify({ lastInjected: Date.now() }), 'utf8');
  } catch (_) { /* best-effort */ }
}

// ─── Reminder Content ─────────────────────────────────────────────────────────

const REMINDER = `## Dev Rules Reminder (Codex)

**Principles:** YAGNI (You Aren't Gonna Need It) · KISS (Keep It Simple, Stupid) · DRY (Don't Repeat Yourself)

**Code Quality:**
- Keep code files under 200 lines — split into focused modules if larger
- Use kebab-case for JS/TS/Python/shell file names (descriptive, self-documenting)
- No syntax errors — code must compile/run cleanly
- Use try/catch for error handling at system boundaries

**Implementation Rules:**
- DO NOT create new files when you can update existing ones
- DO NOT mock or simulate — always implement real code
- Follow codebase patterns in \`./docs/code-standards.md\`
- Read README.md before starting any new implementation

**Reports / Docs:**
- Plans → \`./plans/\` | Docs → \`./docs/\` | Reports → \`./plans/reports/\`
- Sacrifice grammar for concision in reports
- List unresolved questions at end of reports`;

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const payload = stdin ? JSON.parse(stdin) : {};
  const sessionId = payload.session_id || null;

  if (wasRecentlyInjected(sessionId)) {
    // Output empty response — skip injection this turn
    process.exit(0);
  }

  recordInjection(sessionId);
  console.log(JSON.stringify({ systemMessage: REMINDER }));
  process.exit(0);
} catch (err) {
  // Never block user prompt
  console.error(`dev-rules-reminder-codex error: ${err.message}`);
  process.exit(0);
}
