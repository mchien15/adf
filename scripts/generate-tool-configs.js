#!/usr/bin/env node
/**
 * generate-tool-configs.js - Generate Codex + OpenCode agent configs from .claude/agents/*.md
 *
 * Usage: node scripts/generate-tool-configs.js [--dry-run]
 *
 * Reads .claude/agents/*.md (source of truth), outputs:
 *   .codex/agents/{name}.toml   — minimal Codex agent definitions
 *   .opencode/agents/{name}.md  — full OpenCode agent definitions with mapped tools/model
 *
 * No external dependencies — Node built-ins only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const AGENTS_SRC = path.join(ROOT, '.claude', 'agents');
const CODEX_AGENTS_OUT = path.join(ROOT, '.codex', 'agents');
const OPENCODE_AGENTS_OUT = path.join(ROOT, '.opencode', 'agents');

const DRY_RUN = process.argv.includes('--dry-run');

// Claude PascalCase tool → OpenCode lowercase key
const TOOL_MAP = {
  Glob: 'glob',
  Grep: 'grep',
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  MultiEdit: 'edit',        // merged into edit
  Bash: 'bash',
  WebFetch: 'fetch',
  WebSearch: 'websearch',
};

// Claude-specific tools to skip (no OpenCode equivalent)
const SKIP_TOOLS = new Set([
  'Task', 'TaskCreate', 'TaskGet', 'TaskUpdate', 'TaskList',
  'SendMessage', 'NotebookEdit', 'ListMcpResourcesTool', 'ReadMcpResourceTool',
  'KillBash', 'BashOutput',
]);

// Claude shorthand → OpenCode full model ID
const MODEL_MAP = {
  // Use stable OpenCode model aliases instead of dated/provider-specific
  // snapshots that may disappear and trigger ProviderModelNotFoundError.
  opus:   'anthropic/claude-opus-4-1',
  sonnet: 'anthropic/claude-sonnet-4-5',
  haiku:  'anthropic/claude-haiku-4-5',
  inherit:'anthropic/claude-sonnet-4-5',
};
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse a Claude agent markdown file.
 * Extracts YAML frontmatter (simple key:value + quoted strings) and body.
 *
 * @param {string} filePath - Absolute path to the .md file
 * @returns {{ name: string, description: string, model: string, tools: string[], body: string }}
 */
function parseCLaudeAgent(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parts = raw.split(/^---\s*$/m);

  if (parts.length < 3) {
    throw new Error(`No valid frontmatter in ${filePath}`);
  }

  const frontmatter = parts[1];
  const body = parts.slice(2).join('---').trim();

  const meta = {};
  // Parse simple key: value lines — handles multi-line quoted strings
  let remaining = frontmatter;
  const lineRe = /^(\w+):\s*(.*)$/m;
  let match;
  while ((match = lineRe.exec(remaining)) !== null) {
    const [full, key, val] = match;
    remaining = remaining.slice(match.index + full.length);

    let parsed = val.trim();
    // Strip surrounding single/double quotes
    if ((parsed.startsWith("'") && parsed.endsWith("'")) ||
        (parsed.startsWith('"') && parsed.endsWith('"'))) {
      parsed = parsed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    meta[key] = parsed;
  }

  const toolStr = meta.tools || '';
  const tools = toolStr
    .split(',')
    .map(t => t.trim().split('(')[0]) // strip Task(Explore) → Task
    .filter(Boolean);

  return {
    name: meta.name || path.basename(filePath, '.md'),
    description: meta.description || '',
    model: meta.model || '',
    tools,
    body,
  };
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Map Claude tool names to OpenCode tool object.
 * @param {string[]} toolList
 * @returns {Record<string, boolean>}
 */
function mapTools(toolList) {
  const result = {};
  for (const tool of toolList) {
    if (SKIP_TOOLS.has(tool)) continue;
    const mapped = TOOL_MAP[tool];
    if (mapped) result[mapped] = true;
  }
  return result;
}

/**
 * Map Claude model shorthand to OpenCode full model ID.
 * @param {string} shorthand
 * @returns {string}
 */
function mapModel(shorthand) {
  return MODEL_MAP[shorthand] || DEFAULT_MODEL;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Generate Codex TOML content (minimal: name + description only).
 * Model is resolved at session level in Codex.
 *
 * @param {{ name: string, description: string }} agent
 * @returns {string}
 */
function toCodexToml(agent) {
  // Use JSON.stringify for safe string embedding (handles special chars, quotes)
  const safeName = JSON.stringify(agent.name);
  const safeDesc = JSON.stringify(agent.description);
  return `name = ${safeName}\ndescription = ${safeDesc}\n`;
}

/**
 * Generate OpenCode markdown content with YAML frontmatter + original agent body.
 *
 * @param {{ name: string, description: string, model: string, tools: string[], body: string }} agent
 * @returns {string}
 */
function toOpenCodeMd(agent) {
  const toolsObj = mapTools(agent.tools);
  const model = mapModel(agent.model);

  // Build YAML tools block
  const toolsYaml = Object.keys(toolsObj).length > 0
    ? Object.keys(toolsObj).map(k => `  ${k}: true`).join('\n')
    : '  read: true';

  return `---
description: ${JSON.stringify(agent.description)}
mode: subagent
model: ${model}
tools:
${toolsYaml}
permissions:
  edit: ask
  write: allow
---

${agent.body}
`;
}

// ─── I/O Helpers ──────────────────────────────────────────────────────────────

/**
 * Write file only if content differs (avoids git noise on repeated runs).
 * @param {string} filePath
 * @param {string} content
 * @returns {'written'|'skipped'}
 */
function writeIfChanged(filePath, content) {
  if (!DRY_RUN) {
    const existing = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : null;
    if (existing === content) return 'skipped';
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return 'written';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Ensure output dirs exist
  for (const dir of [CODEX_AGENTS_OUT, OPENCODE_AGENTS_OUT]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const agentFiles = fs.readdirSync(AGENTS_SRC)
    .filter(f => f.endsWith('.md'))
    .sort();

  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of agentFiles) {
    const srcPath = path.join(AGENTS_SRC, file);
    try {
      const agent = parseCLaudeAgent(srcPath);

      const codexPath = path.join(CODEX_AGENTS_OUT, `${agent.name}.toml`);
      const opencodePath = path.join(OPENCODE_AGENTS_OUT, `${agent.name}.md`);

      const r1 = writeIfChanged(codexPath, toCodexToml(agent));
      const r2 = writeIfChanged(opencodePath, toOpenCodeMd(agent));

      const status = (r1 === 'written' || r2 === 'written') ? 'written' : 'skipped';
      if (status === 'written') written++; else skipped++;

      const prefix = DRY_RUN ? '[dry-run]' : status === 'written' ? '✓' : '·';
      console.log(`${prefix} ${agent.name}`);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}${agentFiles.length} agents → ${written} written, ${skipped} skipped, ${errors} errors`);
  if (errors > 0) process.exit(1);
}

main();
