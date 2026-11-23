'use strict';

// sync-claude-global.sh: adf-sync-exclude.txt protects user-owned paths from --delete.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', 'sync-claude-global.sh');

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Builds tmp source + tmp home; never touches the real home.
function setup(excludeLines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adf-sync-'));
  const adf = path.join(root, 'adf');
  const home = path.join(root, 'home');
  write(path.join(adf, '.claude', 'metadata.json'), '{}');
  write(path.join(adf, '.claude', 'skills', 'kept-by-adf', 'SKILL.md'), 'adf');
  write(path.join(home, '.claude', 'skills', 'user-skill', 'SKILL.md'), 'mine');
  write(path.join(home, '.claude', 'skills', 'stale-adf-skill', 'SKILL.md'), 'stale');
  if (excludeLines !== null) write(path.join(home, '.claude', 'adf-sync-exclude.txt'), excludeLines);
  const res = spawnSync('bash', [SCRIPT], {
    env: { ...process.env, HOME: home, ADF_HOME: adf },
    encoding: 'utf8',
  });
  return { res, skills: path.join(home, '.claude', 'skills') };
}

test('keeps listed paths and deletes the rest', () => {
  const { res, skills } = setup('# mine\n\n  skills/user-skill/  \n');
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(fs.readFileSync(path.join(skills, 'user-skill', 'SKILL.md'), 'utf8'), 'mine');
  assert.ok(!fs.existsSync(path.join(skills, 'stale-adf-skill')));
  assert.ok(fs.existsSync(path.join(skills, 'kept-by-adf', 'SKILL.md')));
  assert.match(res.stdout, /kept \(adf-sync-exclude\.txt\): skills\/user-skill/);
});

test('deletes unlisted extras without exclude file', () => {
  const { res, skills } = setup(null);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(!fs.existsSync(path.join(skills, 'user-skill')));
});

test('ignores invalid exclude lines', () => {
  const { res, skills } = setup('../etc\nsessions/x\n');
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stderr, /\.\.\/etc/);
  assert.match(res.stderr, /sessions\/x/);
  assert.ok(!fs.existsSync(path.join(skills, 'user-skill')));
});
