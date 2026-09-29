#!/usr/bin/env node
/**
 * dev-rules-reminder-codex.cjs - Codex UserPromptSubmit hook
 *
 * Injects dev rules reminder into every prompt (with debounce to avoid spam).
 * Reads stdin JSON: { session_id, transcript_path?, ... }
 * Outputs JSON with hookSpecificOutput.additionalContext.
 * Exit 0 always (non-blocking).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const {
  loadConfig,
  resolvePlanPath,
  resolvePlansBaseDir,
  getReportsPath,
  resolveNamingPattern,
  REPORT_TYPES,
} = require('../../.agents/hooks/lib/ck-config-utils.cjs');

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

function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_) {
    return null;
  }
}

function detectGitRoot(cwd) {
  return execSafe(`git -C ${JSON.stringify(cwd)} rev-parse --show-toplevel`) || cwd;
}

function ensureTrailingSlash(pathValue) {
  return /[/\\]$/.test(pathValue) ? pathValue : `${pathValue}/`;
}

// ─── Reminder Content ─────────────────────────────────────────────────────────

/**
 * Build the static reminder text.
 * @param {string} plansPath - Resolved plans dir (main git worktree aware)
 * @returns {string}
 */
function buildReminder(plansPath) {
  return `## Dev Rules Reminder (Codex)

**Principles:** YAGNI (You Aren't Gonna Need It) · KISS (Keep It Simple, Stupid) · DRY (Don't Repeat Yourself)

**Code Quality:**
- File names: kebab-case for JS/TS/shell, snake_case for Python; match surrounding names, prefer short names
- No syntax errors — code must compile/run cleanly
- Use try/catch for error handling at system boundaries

**Implementation Rules:**
- DO NOT create new files when you can update existing ones
- DO NOT mock or simulate — always implement real code
- Follow codebase patterns in \`./docs/code-standards.md\`
- Read README.md before starting any new implementation

**Reports / Docs:**
- Plans → \`${plansPath}/\` | Docs → \`./docs/\` | Reports → the active plan's \`reports/\` dir, else \`${plansPath}/reports/{YYMM}/\`
- Sacrifice grammar for concision in reports
- List unresolved questions at end of reports`;
}

function buildPlanContext(projectRoot, sessionId, config, plansBase) {
  const resolved = resolvePlanPath(sessionId, config);
  if (!resolved.path) return '';

  const gitBranch = execSafe('git branch --show-current') || 'unknown';
  const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, config.plan, config.paths);
  const absoluteReportsPath = path.isAbsolute(reportsPath) ? reportsPath : path.join(plansBase, reportsPath);
  const reportPrefix = ensureTrailingSlash(absoluteReportsPath);
  const namePattern = resolveNamingPattern(config.plan, gitBranch);

  return [
    `## Plan Context`,
    resolved.resolvedBy === 'session'
      ? `- Active Plan: ${resolved.path}`
      : `- Plan: ${resolved.path} (matched from branch)`,
    `- Reports: ${reportPrefix}`,
    `- Branch: ${gitBranch}`,
    `- Validation: mode=${config.plan.validation.mode}, questions=${config.plan.validation.minQuestions}-${config.plan.validation.maxQuestions}`,
    ``,
    `## Naming`,
    `- Report: \`${reportPrefix}{type}-${namePattern}.md\``,
    `- Plan dir: \`${path.join(plansBase, config.paths.plans, namePattern)}/\``,
    `- Replace \`{type}\` with one of: ${REPORT_TYPES.join(', ')}`,
  ].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const payload = stdin ? JSON.parse(stdin) : {};
  const sessionId = payload.session_id || process.env.CODEX_THREAD_ID || process.env.CK_SESSION_ID || null;
  const cwd = payload.cwd || process.cwd();
  const projectRoot = detectGitRoot(cwd);
  if (fs.existsSync(projectRoot)) {
    process.chdir(projectRoot);
  }
  const config = loadConfig();
  // plans/ and non-plan reports live in the main git worktree when running in a linked one
  const plansBase = resolvePlansBaseDir(projectRoot);
  const planContext = buildPlanContext(projectRoot, sessionId, config, plansBase);
  const recentlyInjected = wasRecentlyInjected(sessionId);

  if (recentlyInjected && !planContext) {
    process.exit(0);
  }

  if (!recentlyInjected) {
    recordInjection(sessionId);
  }

  const sections = [];
  if (!recentlyInjected) sections.push(buildReminder(path.join(plansBase, config.paths.plans)));
  if (planContext) sections.push(planContext);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: sections.join('\n\n'),
    },
  }));
  process.exit(0);
} catch (err) {
  // Never block user prompt
  console.error(`dev-rules-reminder-codex error: ${err.message}`);
  process.exit(0);
}
