'use strict';

// Claude-only installer: payload surface, legacy multi-tool cleanup, removed commands.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ADF_BIN = path.join(REPO_ROOT, 'scripts', 'adf');
const LEGACY_BLOCK = ['<!-- adf:managed-block:start adf-agents-instructions -->', 'legacy agents', '<!-- adf:managed-block:end adf-agents-instructions -->', ''].join('\n');

function runAdf(target, args) {
  return spawnSync(process.execPath, [ADF_BIN, ...args], {
    cwd: target,
    env: { ...process.env, ADF_HOME: REPO_ROOT, TARGET: target },
    encoding: 'utf8',
  });
}

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'adf-claude-only-'));
}

test('claude install creates only .claude and CLAUDE.md', () => {
  const dir = tmpRepo();
  const res = runAdf(dir, ['claude']);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.claude')));
  assert.match(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /adf-claude-instructions/);
  for (const name of ['.codex', '.opencode', '.agent', '.agents', 'AGENTS.md', 'opencode.json']) {
    assert.ok(!fs.existsSync(path.join(dir, name)), `${name} must not exist`);
  }
});

test('claude install removes legacy multi-tool managed paths', () => {
  const dir = tmpRepo();
  fs.mkdirSync(path.join(dir, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.codex', 'config.toml'), 'x\n');
  fs.symlinkSync('.claude', path.join(dir, '.agents'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), `user text\n\n${LEGACY_BLOCK}`);
  fs.mkdirSync(path.join(dir, '.adf'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.adf', 'manifest.json'), JSON.stringify({
    manifestVersion: '2.0.0',
    installMode: 'all',
    gitProfile: 'adf',
    managedPaths: {
      '.codex/config.toml': { ownership: 'managed-children' },
      '.agents': { ownership: 'generated-exclusive' },
      'AGENTS.md': { ownership: 'managed-block' },
    },
  }));
  const res = runAdf(dir, ['claude']);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(!fs.existsSync(path.join(dir, '.codex')) || !fs.existsSync(path.join(dir, '.codex', 'config.toml')));
  assert.throws(() => fs.lstatSync(path.join(dir, '.agents')));
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(agents, /user text/);
  assert.doesNotMatch(agents, /adf-agents-instructions/);
  assert.ok(fs.readdirSync(path.join(dir, '.adf', 'backups')).length >= 1);
});

test('legacy AGENTS.md is deleted when only the block remains', () => {
  const dir = tmpRepo();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), LEGACY_BLOCK);
  fs.mkdirSync(path.join(dir, '.adf'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.adf', 'manifest.json'), JSON.stringify({
    installMode: 'codex', managedPaths: { 'AGENTS.md': { ownership: 'managed-block' } },
  }));
  assert.strictEqual(runAdf(dir, ['claude']).status, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'AGENTS.md')));
});

test('repair on legacy non-claude manifest repairs as claude', () => {
  const dir = tmpRepo();
  assert.strictEqual(runAdf(dir, ['claude']).status, 0);
  const mPath = path.join(dir, '.adf', 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  m.installMode = 'all';
  fs.writeFileSync(mPath, JSON.stringify(m));
  fs.rmSync(path.join(dir, '.claude', 'metadata.json'), { force: true });
  const res = runAdf(dir, ['repair']);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'metadata.json')));
  assert.strictEqual(JSON.parse(fs.readFileSync(mPath, 'utf8')).installMode, 'claude');
});

test('removed tool commands fail as unknown', () => {
  for (const cmd of ['codex', 'opencode', 'oc', 'ag', 'antigravity', 'all']) {
    const res = runAdf(tmpRepo(), [cmd]);
    assert.strictEqual(res.status, 1, cmd);
    assert.match(res.stdout + res.stderr, new RegExp(`Unknown command: ${cmd}`));
  }
});
