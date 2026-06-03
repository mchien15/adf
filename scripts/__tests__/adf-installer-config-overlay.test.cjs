'use strict';

// Regression tests for the cmc-profile docs-path feature (Phase 1):
// - deepMerge: partial overlay config must not clobber base config keys
// - mergeOverlayConfig: file-level deep merge of an overlay adf-config.json into the base
// - ensureAdfGitignore: scoped whitelist keeps .adf/docs/ tracked, write-if-absent

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { deepMerge, mergeOverlayConfig, ensureAdfGitignore, rootIgnoresAdf, createInstallerContext } =
  require('../adf-installer-lib.js');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('deepMerge applies overlay overrides while preserving base keys', () => {
  const base = { statusline: 'minimal', docs: { maxLoc: 800 }, paths: { docs: 'docs', plans: 'plans' } };
  const overlay = { paths: { docs: '.adf/docs' } };
  const merged = deepMerge(base, overlay);
  assert.strictEqual(merged.paths.docs, '.adf/docs', 'overlay override applied');
  assert.strictEqual(merged.paths.plans, 'plans', 'sibling key preserved');
  assert.strictEqual(merged.statusline, 'minimal', 'unrelated base key preserved');
  assert.strictEqual(merged.docs.maxLoc, 800, 'nested base key preserved');
  assert.strictEqual(base.paths.docs, 'docs', 'base object not mutated');
});

test('deepMerge replaces arrays/scalars wholesale (overlay wins)', () => {
  assert.deepStrictEqual(deepMerge({ a: [1, 2] }, { a: [3] }), { a: [3] });
  assert.strictEqual(deepMerge({ a: 1 }, 5), 5);
});

test('mergeOverlayConfig merges a partial overlay file into the base config file', () => {
  const dir = tmpDir('adf-cfg-');
  const basePath = path.join(dir, 'adf-config.json');
  const overlayPath = path.join(dir, 'overlay.json');
  fs.writeFileSync(basePath, JSON.stringify({ statusline: 'minimal', paths: { docs: 'docs', plans: 'plans' } }));
  fs.writeFileSync(overlayPath, JSON.stringify({ paths: { docs: '.adf/docs' } }));

  mergeOverlayConfig(basePath, overlayPath);

  const result = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  assert.strictEqual(result.paths.docs, '.adf/docs');
  assert.strictEqual(result.paths.plans, 'plans');
  assert.strictEqual(result.statusline, 'minimal');
});

test('mergeOverlayConfig is a no-op when the overlay file is absent', () => {
  const dir = tmpDir('adf-cfg-');
  const basePath = path.join(dir, 'adf-config.json');
  fs.writeFileSync(basePath, JSON.stringify({ paths: { docs: 'docs' } }));
  mergeOverlayConfig(basePath, path.join(dir, 'missing.json'));
  assert.strictEqual(JSON.parse(fs.readFileSync(basePath, 'utf8')).paths.docs, 'docs');
});

test('ensureAdfGitignore writes the scoped whitelist when absent', () => {
  const dir = tmpDir('adf-target-');
  const ctx = createInstallerContext({ TARGET: dir });
  ensureAdfGitignore(ctx);
  const written = fs.readFileSync(path.join(dir, '.adf', '.gitignore'), 'utf8');
  assert.strictEqual(written, ['/*', '!/.gitignore', '!/docs/', ''].join('\n'));
});

test('ensureAdfGitignore does not overwrite a user-owned file', () => {
  const dir = tmpDir('adf-target-');
  const ctx = createInstallerContext({ TARGET: dir });
  const target = path.join(dir, '.adf', '.gitignore');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '# user override\n');
  ensureAdfGitignore(ctx);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), '# user override\n');
});

test('rootIgnoresAdf flags only whole-.adf blanket rules', () => {
  for (const rule of ['.adf', '.adf/', '/.adf', '/.adf/', '  .adf  ']) {
    assert.ok(rootIgnoresAdf(`node_modules\n${rule}\n`), `should flag: ${rule}`);
  }
  for (const rule of ['.adf/payload', '.adf/backups/', '.adfx', 'docs/', '# .adf']) {
    assert.ok(!rootIgnoresAdf(`node_modules\n${rule}\n`), `should NOT flag: ${rule}`);
  }
});
