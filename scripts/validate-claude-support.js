#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

expect(fileExists('CLAUDE.md'), 'Missing CLAUDE.md');
expect(fileExists('.claude/settings.json'), 'Missing .claude/settings.json');
expect(fileExists('.claude/agents'), 'Missing .claude/agents');
expect(fileExists('.claude/skills'), 'Missing .claude/skills');

if (fileExists('.claude/settings.json')) {
  const settings = readJson('.claude/settings.json');
  const hooks = settings.hooks || {};
  for (const hookName of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse']) {
    expect(Array.isArray(hooks[hookName]), `Claude hook ${hookName} is missing or invalid`);
  }
}

if (fileExists('.claude/agents')) {
  const agents = fs.readdirSync(path.join(ROOT, '.claude', 'agents')).filter((name) => name.endsWith('.md'));
  expect(agents.length === 16, `Expected 16 Claude agents, found ${agents.length}`);
}

if (fileExists('.claude/skills')) {
  const skills = fs.readdirSync(path.join(ROOT, '.claude', 'skills')).filter((name) => fileExists(path.join('.claude', 'skills', name, 'SKILL.md')));
  expect(skills.length === 45, `Expected 45 Claude skills, found ${skills.length}`);
}

if (failures.length > 0) {
  console.error('Claude support validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Claude support validation passed');
