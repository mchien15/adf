#!/usr/bin/env node
/**
 * session-init-codex.cjs - Codex SessionStart hook
 *
 * Injects project context: datetime, CWD, project type, dev rules reminder.
 * Reads stdin JSON: { session_id, cwd }
 * Outputs JSON: { systemMessage: "..." }
 * Exit 0 always (non-blocking).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_) {
    return null;
  }
}

/**
 * Detect project type from CWD by checking for known manifest files.
 * Reuses the same detection heuristic as .claude/hooks/lib/project-detector.cjs
 * without requiring a direct import (Codex hook CWD may differ).
 *
 * @param {string} cwd
 * @returns {string} project type label
 */
function detectProjectType(cwd) {
  const exists = (f) => fs.existsSync(path.join(cwd, f));

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

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const payload = stdin ? JSON.parse(stdin) : {};

  const cwd = payload.cwd || process.cwd();
  const now = new Date();
  const datetime = now.toLocaleString('en-US', { timeZoneName: 'short' });
  const projectType = detectProjectType(cwd);
  const gitBranch = execSafe('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const nodeVersion = execSafe('node --version') || 'unknown';
  const platform = `${os.type()} ${os.release()}`;

  const systemMessage = [
    `## Session Context (Codex)`,
    `- DateTime: ${datetime}`,
    `- CWD: ${cwd}`,
    `- Platform: ${platform}`,
    `- Node: ${nodeVersion}`,
    `- Project Type: ${projectType}`,
    `- Git Branch: ${gitBranch}`,
    ``,
    `## Dev Rules`,
    `- Rules: \`.claude/rules/development-rules.md\` (follow strictly)`,
    `- Principles: YAGNI, KISS, DRY`,
    `- File size: keep code files under 200 lines`,
    `- Naming: kebab-case for JS/TS/Python/shell`,
    `- Docs: \`./docs/\` directory`,
    `- Plans: \`./plans/\` directory`,
    ``,
    `## Skills`,
    `- Skills available: \`.agents/skills/\` (51 skills)`,
    `- Agent configs: \`.codex/agents/\` (Codex-native)`,
    `- After editing \`.claude/agents/*.md\`, run: node scripts/generate-tool-configs.js`,
  ].join('\n');

  console.log(JSON.stringify({ systemMessage }));
  process.exit(0);
} catch (err) {
  // Never block session start
  console.error(`session-init-codex error: ${err.message}`);
  process.exit(0);
}
