#!/usr/bin/env node
/**
 * generate-tool-configs.js - Generate Codex + OpenCode agent configs from a Claude agents source tree
 *
 * Usage: node scripts/generate-tool-configs.js [--dry-run] [--source-root PATH] [--codex-out PATH] [--opencode-out PATH]
 *
 * Reads a Claude agents source tree (defaults to .claude/agents), outputs:
 *   .codex/agents/{name}.toml   — Codex custom agents with developer instructions
 *   .opencode/agents/{name}.md  — full OpenCode agent definitions with mapped tools/model
 *
 * No external dependencies — Node built-ins only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return path.resolve(value);
}

const AGENTS_SRC = readArg('--source-root', path.join(ROOT, '.claude', 'agents'));
const CODEX_AGENTS_OUT = readArg('--codex-out', path.join(ROOT, '.codex', 'agents'));
const OPENCODE_AGENTS_OUT = readArg('--opencode-out', path.join(ROOT, '.opencode', 'agents'));
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

// Claude shorthand → OpenCode GitHub Copilot model IDs
const MODEL_MAP = {
  opus: 'github-copilot/claude-sonnet-4.6',
  sonnet: 'github-copilot/claude-sonnet-4.6',
  haiku: 'github-copilot/claude-haiku-4.5',
  inherit: 'github-copilot/claude-sonnet-4.6',
};
const DEFAULT_MODEL = 'github-copilot/claude-sonnet-4.6';

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse a Claude agent markdown file.
 * Extracts YAML frontmatter (simple key:value + quoted strings) and body.
 *
 * @param {string} filePath - Absolute path to the .md file
 * @returns {{ name: string, description: string, model: string, memory: string, tools: string[], body: string, sourceFile: string }}
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
  const lines = frontmatter.split('\n');

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let parsed = rawValue.trim();

    if (parsed === '>-' || parsed === '>' || parsed === '|' || parsed === '|-') {
      const blockLines = [];
      while (index + 1 < lines.length && /^(\s{2,}|\t)/.test(lines[index + 1])) {
        blockLines.push(lines[index + 1].replace(/^(\s{2}|\t)/, ''));
        index++;
      }
      parsed = parsed.startsWith('>')
        ? blockLines.join(' ').replace(/\s+/g, ' ').trim()
        : blockLines.join('\n').trim();
    }

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
    memory: meta.memory || '',
    tools,
    body,
    sourceFile: path.basename(filePath),
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

function describeModelMapping(shorthand) {
  if (!shorthand) return null;
  const mapped = mapModel(shorthand);
  if ((shorthand === 'opus' || shorthand === 'sonnet' || shorthand === 'haiku' || shorthand === 'inherit') && mapped !== shorthand) {
    return `Generated OpenCode model: ${mapped}.`;
  }
  return null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Generate Codex TOML content with embedded developer instructions.
 *
 * @param {{ name: string, description: string, model: string, memory: string, tools: string[], body: string, sourceFile: string }} agent
 * @returns {string}
 */
function toTomlMultilineString(value) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/"""/g, '\\"\\"\\"');
  return `"""\n${normalized}\n"""`;
}

function toCodexDeveloperInstructions(agent) {
  const header = [
    `Generated from .claude/agents/${agent.sourceFile}.`,
    'Treat this file as a Codex-native projection of the canonical Claude agent.',
  ];

  if (agent.model) header.push(`Preferred source model: ${agent.model}.`);
  if (agent.memory) header.push(`Source memory scope: ${agent.memory}.`);
  if (agent.tools.length > 0) header.push(`Source tool surface: ${agent.tools.join(', ')}.`);

  return `${header.join(' ')}\n\n${agent.body.trim()}`.trim();
}

function toCodexToml(agent) {
  const safeName = JSON.stringify(agent.name);
  const safeDesc = JSON.stringify(agent.description);
  const safeInstructions = toTomlMultilineString(toCodexDeveloperInstructions(agent));
  return `name = ${safeName}\ndescription = ${safeDesc}\ndeveloper_instructions = ${safeInstructions}\n`;
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
  const mappedModelNote = describeModelMapping(agent.model);

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
permission:
  edit: ask
  write: allow
---

${mappedModelNote ? `<!-- ${mappedModelNote} -->\n\n` : ''}${agent.body}
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
  if (!fs.existsSync(AGENTS_SRC)) {
    throw new Error(`Agent source not found: ${AGENTS_SRC}`);
  }

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
