/**
 * adf-hooks.js - ADF plugin for OpenCode
 *
 * Ports 4 Claude Code hooks to OpenCode plugin events:
 *   session.created       → project context injection (like session-init.cjs)
 *   tool.execute.before   → privacy block on sensitive file reads/writes
 *   tool.execute.after    → post-edit simplify reminder
 *
 * ESM format (OpenCode plugin requirement). No external dependencies.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { type as osType, release as osRelease } from 'os';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const SAFE_PATTERNS = [
  /\.example$/i,
  /\.sample$/i,
  /\.template$/i,
];

// Tools that write/edit files — trigger simplify reminder
const EDIT_TOOLS = new Set(['write', 'edit', 'multiedit', 'patch']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_) {
    return null;
  }
}

function isSafeFile(p) {
  const base = basename(p);
  return SAFE_PATTERNS.some(re => re.test(base));
}

function isSensitivePath(p) {
  if (!p || isSafeFile(p)) return false;
  return SENSITIVE_PATTERNS.some(re => re.test(p));
}

/**
 * Detect project type from directory contents.
 * @param {string} cwd
 * @returns {string}
 */
function detectProjectType(cwd) {
  const exists = (f) => existsSync(join(cwd, f));
  if (exists('package.json')) {
    if (exists('next.config.js') || exists('next.config.ts')) return 'Next.js';
    if (exists('vite.config.js') || exists('vite.config.ts')) return 'Vite/React';
    if (exists('nest-cli.json')) return 'NestJS';
    return 'Node.js';
  }
  if (exists('pyproject.toml') || exists('requirements.txt')) return 'Python';
  if (exists('go.mod')) return 'Go';
  if (exists('Cargo.toml')) return 'Rust';
  if (exists('.claude/skills')) return 'ADF (Claude Code Framework)';
  return 'Unknown';
}

// ─── Plugin Export ────────────────────────────────────────────────────────────

export default async function adfHooksPlugin({ project }) {
  const cwd = project?.directory || process.cwd();

  return {
    /**
     * session.created — inject project context on session start.
     * Equivalent to .claude/hooks/session-init.cjs
     */
    'session.created': async (_event) => {
      try {
        const now = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
        const projectType = detectProjectType(cwd);
        const gitBranch = execSafe('git rev-parse --abbrev-ref HEAD') || 'unknown';
        const nodeVersion = execSafe('node --version') || 'unknown';
        const platform = `${osType()} ${osRelease()}`;

        return {
          systemMessage: [
            `## Session Context (OpenCode)`,
            `- DateTime: ${now}`,
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
            ``,
            `## Skills & Agents`,
            `- Skills: \`.claude/skills/\` (discovered natively by OpenCode)`,
            `- Agents: \`.opencode/agents/\` (Tab to switch, @name to mention)`,
            `- After editing \`.claude/agents/*.md\`, run: node scripts/generate-tool-configs.js`,
          ].join('\n'),
        };
      } catch (_) {
        return null;
      }
    },

    /**
     * tool.execute.before — privacy block on sensitive file access.
     * Equivalent to .claude/hooks/privacy-block.cjs
     * Intercepts Read, Write, Edit, Bash tools.
     */
    'tool.execute.before': async (event) => {
      try {
        const toolName = (event?.tool || '').toLowerCase();
        const input = event?.input || {};

        // Collect paths from tool input depending on tool type
        const pathsToCheck = [];
        if (input.file_path) pathsToCheck.push(input.file_path);
        if (input.path) pathsToCheck.push(input.path);
        // For bash: check if command reads sensitive files
        if (toolName === 'bash' && input.command) {
          const tokens = input.command.split(/[\s|;&><]+/);
          tokens
            .filter(t => t.startsWith('.') || t.includes('/') || t.startsWith('~'))
            .forEach(t => pathsToCheck.push(t));
        }

        for (const p of pathsToCheck) {
          if (isSensitivePath(p)) {
            return {
              block: true,
              message: [
                `PRIVACY BLOCK: Access to "${basename(p)}" is restricted.`,
                ``,
                `This file may contain sensitive data (credentials, keys, secrets).`,
                `Confirm authorization before accessing this file.`,
              ].join('\n'),
            };
          }
        }

        return null; // allow
      } catch (_) {
        return null; // fail open — never block on hook error
      }
    },

    /**
     * tool.execute.after — post-edit simplify reminder.
     * Equivalent to .claude/hooks/post-edit-simplify-reminder.cjs
     * Fires after Edit/Write tools to encourage code simplification.
     */
    'tool.execute.after': async (event) => {
      try {
        const toolName = (event?.tool || '').toLowerCase();
        if (!EDIT_TOOLS.has(toolName)) return null;

        return {
          systemMessage: [
            `## Post-Edit Reminder`,
            `You just edited code. Before continuing:`,
            `- Is this the simplest implementation? (KISS)`,
            `- Any duplication that can be extracted? (DRY)`,
            `- Did you add anything not strictly needed? (YAGNI)`,
            `- Is the file still under 200 lines?`,
            ``,
            `Run \`/simplify\` if code can be cleaner.`,
          ].join('\n'),
        };
      } catch (_) {
        return null;
      }
    },
  };
}
