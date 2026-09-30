#!/usr/bin/env node
/**
 * session-init-codex.cjs - Codex SessionStart hook
 *
 * Injects project context: datetime, CWD, project type, support-surface reminder.
 * Reads stdin JSON: { session_id, cwd }
 * Outputs JSON with hookSpecificOutput.additionalContext.
 * Exit 0 always (non-blocking).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const {
  loadConfig,
  readSessionState,
  resolvePlanPath,
  resolvePlansBaseDir,
  getReportsPath,
  resolveNamingPattern,
  writeSessionState,
  REPORT_TYPES,
} = require('../../.agents/hooks/lib/ck-config-utils.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Detect project type from CWD by checking for known manifest files.
 * Reuses the same detection heuristic as .claude/hooks/lib/project-detector.cjs
 * without requiring a direct import (Codex hook CWD may differ).
 *
 * @param {string} cwd
 * @returns {string} project type label
 */
function detectProjectType(projectRoot) {
  const exists = (f) => fs.existsSync(path.join(projectRoot, f));

  if (exists('package.json')) {
    if (exists('next.config.js') || exists('next.config.ts')) return 'Next.js';
    if (exists('vite.config.js') || exists('vite.config.ts')) return 'Vite/React';
    if (exists('nest-cli.json')) return 'NestJS';
    return 'Node.js';
  }
  if (exists('pyproject.toml') || exists('setup.py') || exists('requirements.txt')) {
    if (exists('manage.py')) return 'Django';
    if (exists('app.py') || exists('main.py')) return 'FastAPI/Flask';
    return 'Python';
  }
  if (exists('go.mod')) return 'Go';
  if (exists('Cargo.toml')) return 'Rust';
  if (exists('pom.xml')) return 'Java/Maven';
  if (exists('build.gradle') || exists('build.gradle.kts')) return 'Java/Gradle';
  if (exists('.claude/skills')) return 'ADF (Claude Code Framework)';
  return 'Unknown';
}

function ensureTrailingSlash(pathValue) {
  return /[/\\]$/.test(pathValue) ? pathValue : `${pathValue}/`;
}

function buildPlanContext(projectRoot, sessionId, config, plansBase) {
  const resolved = resolvePlanPath(sessionId, config);
  const gitBranch = execSafe('git branch --show-current') || 'unknown';
  const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, config.plan, config.paths);
  const absoluteReportsPath = path.isAbsolute(reportsPath) ? reportsPath : path.join(plansBase, reportsPath);
  const reportPrefix = ensureTrailingSlash(absoluteReportsPath);
  const namePattern = resolveNamingPattern(config.plan, gitBranch);
  const planLabel = !resolved.path
    ? 'Active Plan: none'
    : resolved.resolvedBy === 'session'
      ? `Active Plan: ${resolved.path}`
      : `Plan: ${resolved.path} (matched from branch)`;

  return [
    `## Plan Context`,
    `- ${planLabel}`,
    `- Reports: ${reportPrefix}`,
    `- Branch: ${gitBranch}`,
    `- Validation: mode=${config.plan.validation.mode}, questions=${config.plan.validation.minQuestions}-${config.plan.validation.maxQuestions}`,
    ``,
    `## Naming`,
    `- Report: \`${reportPrefix}{type}-${namePattern}.md\``,
    `- Plan dir: \`${path.join(plansBase, config.paths.plans, namePattern)}/\``,
    `- Replace \`{type}\` with one of: ${REPORT_TYPES.join(', ')}`,
    `- Replace \`{slug}\` in pattern with: short-kebab-slug (2–4 plain words)`,
  ].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const payload = stdin ? JSON.parse(stdin) : {};

  const cwd = payload.cwd || process.cwd();
  const sessionId = payload.session_id || process.env.CODEX_THREAD_ID || process.env.CK_SESSION_ID || null;
  const projectRoot = detectGitRoot(cwd);
  if (fs.existsSync(projectRoot)) {
    process.chdir(projectRoot);
  }
  const now = new Date();
  const datetime = now.toLocaleString('en-US', { timeZoneName: 'short' });
  const projectType = detectProjectType(projectRoot);
  const gitBranch = execSafe('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const nodeVersion = execSafe('node --version') || 'unknown';
  const platform = `${os.type()} ${os.release()}`;
  const config = loadConfig();
  // plans/ and non-plan reports live in the main git worktree when running in a linked one
  const plansBase = resolvePlansBaseDir(projectRoot);
  const resolved = resolvePlanPath(sessionId, config);
  const currentState = readSessionState(sessionId) || {};

  if (sessionId) {
    writeSessionState(sessionId, {
      ...currentState,
      sessionOrigin: projectRoot,
      activePlan: resolved.resolvedBy === 'session' ? resolved.path : null,
      suggestedPlan: resolved.resolvedBy === 'branch' ? resolved.path : null,
      timestamp: Date.now(),
      source: payload.source || payload.matcher || 'codex-session-init',
    });
  }

  const additionalContext = [
    `## Session Context (Codex)`,
    `- DateTime: ${datetime}`,
    `- CWD: ${cwd}`,
    `- Platform: ${platform}`,
    `- Node: ${nodeVersion}`,
    `- Project Type: ${projectType}`,
    `- Git Branch: ${gitBranch}`,
    ``,
    `## Dev Rules`,
    `- Rules: \`.agent/rules/development-rules.md\` (follow strictly)`,
    `- Principles: YAGNI, KISS, DRY`,
    `- Naming: kebab-case for JS/TS/shell, snake_case for Python; plain conventional words, one term per concept, no metaphors; match surrounding names; unclear one → keep it for its concept and flag it`,
    `- Docs: \`./docs/\` directory`,
    `- Plans: \`${path.join(plansBase, config.paths.plans)}/\` directory`,
    ``,
    `## Support Surface`,
    `- Skills authored in: \`.claude/skills/\` and exposed to Codex via \`.agents/skills/\` (44 skills)`,
    `- Custom agents: \`.codex/agents/\` (generated Codex-native TOML files)`,
    `- After editing \`.claude/agents/*.md\`, run: node scripts/generate-tool-configs.js`,
    `- Workflow model is shared with Claude/OpenCode, but Codex invocation stays tool-native`,
    ``,
    buildPlanContext(projectRoot, sessionId, config, plansBase),
  ].join('\n');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  }));
  process.exit(0);
} catch (err) {
  // Never block session start
  console.error(`session-init-codex error: ${err.message}`);
  process.exit(0);
}
