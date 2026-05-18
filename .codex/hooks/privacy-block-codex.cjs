#!/usr/bin/env node
/**
 * privacy-block-codex.cjs - Codex PreToolUse(Bash) privacy hook
 *
 * Blocks bash commands that attempt to read sensitive files (.env, keys, creds).
 * Reads stdin JSON: { tool: "Bash", input: { command: "..." } }
 * On block: exit 2, write message to stderr.
 * On allow: exit 0 (no output needed).
 *
 * Note: Codex PreToolUse only intercepts Bash, so this hook protects bash-driven reads only.
 * Read/Edit/Write requests still depend on Codex approval controls and operator judgment.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Sensitive file patterns ──────────────────────────────────────────────────
// Mirrors patterns from .claude/hooks/lib/privacy-checker.cjs

const SAFE_PATTERNS = [
  /\.example$/i,
  /\.sample$/i,
  /\.template$/i,
];

const SENSITIVE_PATTERNS = [
  /^\.env$/,
  /^\.env\./,
  /\.env$/,
  /\/\.env\./,
  /credentials/i,
  /secrets?\.ya?ml$/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
];

// Commands that read file contents (read-oriented bash builtins/tools)
const READ_COMMANDS = ['cat', 'head', 'tail', 'less', 'more', 'bat', 'tac', 'nl'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract file paths mentioned in a bash command (simple heuristic).
 * @param {string} command
 * @returns {string[]}
 */
function extractPaths(command) {
  // Split on whitespace/pipes/redirects, filter tokens that look like paths
  return command
    .split(/[\s|;&><]+/)
    .filter(t => t.startsWith('.') || t.startsWith('/') || t.includes('/') || t.startsWith('~'));
}

function isSafeFile(p) {
  const base = path.basename(p);
  return SAFE_PATTERNS.some(re => re.test(base));
}

function isSensitive(p) {
  if (isSafeFile(p)) return false;
  return SENSITIVE_PATTERNS.some(re => re.test(p));
}

/**
 * Check if a bash command is reading a sensitive file.
 * Heuristic: command starts with a read tool AND mentions a sensitive path.
 *
 * @param {string} command
 * @returns {{ blocked: boolean, path?: string }}
 */
function checkCommand(command) {
  const firstToken = command.trim().split(/\s+/)[0];
  const isReadCmd = READ_COMMANDS.includes(path.basename(firstToken));
  if (!isReadCmd) return { blocked: false };

  const paths = extractPaths(command);
  for (const p of paths) {
    if (isSensitive(p)) return { blocked: true, path: p };
  }
  return { blocked: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const payload = JSON.parse(stdin);
  const command = (payload.input && payload.input.command) || '';

  if (!command) process.exit(0);

  const { blocked, path: sensitiveFile } = checkCommand(command);

  if (blocked) {
    const msg = [
      `PRIVACY BLOCK: Access to "${sensitiveFile}" is restricted.`,
      ``,
      `This file may contain sensitive data (credentials, keys, secrets).`,
      `To access it, explicitly confirm this is authorized and re-run the command`,
      `with an appropriate justification in your task context.`,
    ].join('\n');

    process.stderr.write(msg + '\n');
    process.exit(2);
  }

  process.exit(0);
} catch (err) {
  // Never block on hook errors
  console.error(`privacy-block-codex error: ${err.message}`);
  process.exit(0);
}
