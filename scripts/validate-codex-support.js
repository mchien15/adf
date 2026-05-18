#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(absolute(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function collectHookCommands(groups) {
  const commands = [];
  for (const entries of Object.values(groups || {})) {
    for (const entry of entries || []) {
      for (const hook of entry.hooks || []) {
        if (hook.type === 'command' && typeof hook.command === 'string') {
          commands.push(hook.command);
        }
      }
    }
  }
  return commands;
}

function extractRepoRelativeHookPath(command) {
  const match = command.match(/\$\(git rev-parse --show-toplevel\)\/([^"']+)/);
  return match ? match[1] : null;
}

expect(exists('AGENTS.md'), 'Missing AGENTS.md');
expect(exists('.codex/config.toml'), 'Missing .codex/config.toml');
expect(exists('.codex/hooks.json'), 'Missing .codex/hooks.json');
expect(exists('.codex/agents'), 'Missing .codex/agents');
expect(exists('.agents'), 'Missing .agents support path');

if (exists('.codex/config.toml')) {
  const config = read('.codex/config.toml');
  expect(config.includes('project_doc_fallback_filenames = ["CLAUDE.md"]'), 'Codex config missing CLAUDE.md fallback');
  expect(config.includes('[agents]'), 'Codex config missing [agents] section');
  expect(config.includes('max_depth = 2'), 'Codex config missing max_depth');
  expect(config.includes('max_threads = 8'), 'Codex config missing max_threads');
}

if (exists('.codex/hooks.json')) {
  const hooks = JSON.parse(read('.codex/hooks.json'));
  const events = new Set(Object.keys(hooks.hooks || {}));
  for (const eventName of ['SessionStart', 'UserPromptSubmit', 'PreToolUse']) {
    expect(events.has(eventName), `Codex hooks missing ${eventName}`);
  }

  for (const command of collectHookCommands(hooks.hooks)) {
    const repoRelativePath = extractRepoRelativeHookPath(command);
    expect(Boolean(repoRelativePath), `Codex hook command should resolve from git root: ${command}`);
    if (repoRelativePath) {
      expect(exists(repoRelativePath), `Codex hook script missing: ${repoRelativePath}`);
    }
  }
}

if (exists('.claude/agents') && exists('.codex/agents')) {
  const sourceAgents = fs.readdirSync(absolute('.claude/agents')).filter((name) => name.endsWith('.md'));
  const codexAgents = fs.readdirSync(absolute('.codex/agents')).filter((name) => name.endsWith('.toml'));
  expect(codexAgents.length === sourceAgents.length, `Expected ${sourceAgents.length} Codex agents, found ${codexAgents.length}`);
  for (const agentFile of codexAgents) {
    const content = read(path.join('.codex/agents', agentFile));
    expect(/developer_instructions\s*=\s*"""/.test(content), `${agentFile} missing developer_instructions`);
  }
}

if (failures.length > 0) {
  console.error('Codex support validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Codex support validation passed');
