'use strict';

// Regression tests for the cmc code-level-only docs mode (Phase 3):
// - DEFAULT_CONFIG.docs.codeLevelOnly defaults to false
// - buildPathsSection injects the "Docs mode: code-level only" signal only when the flag is set

const test = require('node:test');
const assert = require('node:assert');

const { buildPathsSection } = require('../context-builder.cjs');
const { DEFAULT_CONFIG } = require('../ck-config-utils.cjs');

const FLAG = /Docs mode: code-level only/;
const base = { reportsPath: 'r', plansPath: 'p', docsPath: 'd', docsMaxLoc: 800 };

test('codeLevelOnly defaults to false in DEFAULT_CONFIG', () => {
  assert.strictEqual(DEFAULT_CONFIG.docs.codeLevelOnly, false);
});

test('buildPathsSection injects the flag when docsCodeLevelOnly is true', () => {
  const out = buildPathsSection({ ...base, docsCodeLevelOnly: true }).join('\n');
  assert.match(out, FLAG);
});

test('buildPathsSection omits the flag by default / when false', () => {
  assert.doesNotMatch(buildPathsSection({ ...base }).join('\n'), FLAG);
  assert.doesNotMatch(buildPathsSection({ ...base, docsCodeLevelOnly: false }).join('\n'), FLAG);
});
