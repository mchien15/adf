#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const readme = read('README.md');
const supportMatrix = read('docs/tool-support-matrix.md');

expect(!readme.includes('same commands, same workflows'), 'README still promises same-command parity across tools');
expect(!readme.includes('Same framework, same commands, same quality'), 'README footer still promises same-command parity');
expect(readme.includes('[Tool Support Matrix](./docs/tool-support-matrix.md)'), 'README should link to docs/tool-support-matrix.md');
expect(readme.includes('| OpenAI Codex |'), 'README missing Codex support row');
expect(readme.includes('✅ 45 via `.agents/skills/`'), 'README Codex skills cell drifted');
expect(readme.includes('✅ 16 generated native agents'), 'README Codex agents cell drifted');
expect(readme.includes('⚠️ Degraded privacy hook coverage*'), 'README Codex hooks cell drifted');

expect(supportMatrix.includes('`native`'), 'Support matrix missing native status');
expect(supportMatrix.includes('`degraded`'), 'Support matrix missing degraded status');
expect(supportMatrix.includes('`unsupported`'), 'Support matrix missing unsupported status');
expect(supportMatrix.includes('Codex privacy blocking is limited by Codex hook coverage'), 'Support matrix missing Codex privacy limitation note');
expect(supportMatrix.includes('node scripts/validate-codex-support.js'), 'Support matrix missing release gate commands');

if (failures.length > 0) {
  console.error('Support matrix validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Support matrix validation passed');
