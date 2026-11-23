#!/usr/bin/env node
/**
 * Tests for context-builder.cjs - paths, plan context and naming sections
 * Run: node --test .claude/hooks/lib/__tests__/context-builder.test.cjs
 */

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// The modules under test read os.homedir(): resolveRulesPath() falls back to ~/.claude/{rules,workflows}
// on every call, and ck-config-utils computes GLOBAL_CONFIG_PATH once at load time. So HOME must point
// at an empty dir BEFORE they are required, or a real ~/.claude on the machine leaks into the results.
// (os.homedir() reads HOME on POSIX, USERPROFILE on Windows.)
const originalHomeEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'context-builder-home-'));
process.env.HOME = fakeHome;
process.env.USERPROFILE = fakeHome;

// Import the module under test
const contextBuilder = require('../context-builder.cjs');
const { writeSessionState } = require('../ck-config-utils.cjs');

/**
 * Create a temporary directory with optional subdirectories
 */
function createTempDir(subdirs = []) {
  const tempDir = path.join(os.tmpdir(), 'context-builder-test-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  fs.mkdirSync(tempDir, { recursive: true });

  for (const subdir of subdirs) {
    fs.mkdirSync(path.join(tempDir, subdir), { recursive: true });
  }

  return tempDir;
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a test file in the specified directory
 */
function createTestFile(dir, filename, content = '# Test file\n') {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('context-builder.cjs', () => {

  after(() => {
    for (const [key, value] of Object.entries(originalHomeEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    cleanupTempDir(fakeHome);
  });

  describe('buildReminderContext()', () => {
    let tempDir;
    let originalCwd;

    before(() => {
      originalCwd = process.cwd();
    });

    afterEach(() => {
      process.chdir(originalCwd);
      if (tempDir) cleanupTempDir(tempDir);
      tempDir = undefined;
    });

    it('returns content, lines, and sections', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(result.content, 'Should have content');
      assert.ok(Array.isArray(result.lines), 'Should have lines array');
      assert.ok(result.sections, 'Should have sections object');
      assert.deepStrictEqual(Object.keys(result.sections), ['paths', 'planContext', 'naming']);
      assert.doesNotMatch(result.content, /## (Language|Session|Usage Limits|Rules)|Current Session's Context/);
    });

    // Regression: every other case here omits baseDir, so the absolute-path branch went
    // untested — that blind spot is what let the reports-path prefix doubling ship.
    it('does not double baseDir in reports path when a plan is active', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const sessionId = 'ctx-builder-abs-plan-test';
      // set-active-plan.cjs stores the plan path absolute (Issue #335).
      // A session plan only counts while its dir exists (archived plans are ignored)
      fs.mkdirSync(path.join(tempDir, 'plans/my-plan'), { recursive: true });
      writeSessionState(sessionId, { activePlan: path.join(tempDir, 'plans/my-plan') });

      const result = contextBuilder.buildReminderContext({
        sessionId,
        staticEnv: {},
        baseDir: tempDir
      });

      const reportsLine = result.lines.find((l) => l.includes('Reports:'));
      assert.ok(reportsLine, 'Should emit a Reports line');
      assert.ok(
        !reportsLine.includes(path.join(tempDir, tempDir)),
        `baseDir must not appear twice: ${reportsLine}`
      );
      assert.ok(
        reportsLine.includes(path.join(tempDir, 'plans/my-plan/reports')),
        `Should point at the active plan reports dir: ${reportsLine}`
      );
    });

    // buildNamingSection concatenates a filename onto reportsPath, so the trailing
    // separator must survive path.resolve (which strips it).
    it('keeps a trailing separator so the Report naming pattern stays well-formed', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const sessionId = 'ctx-builder-slash-test';
      // A session plan only counts while its dir exists (archived plans are ignored)
      fs.mkdirSync(path.join(tempDir, 'plans/my-plan'), { recursive: true });
      writeSessionState(sessionId, { activePlan: path.join(tempDir, 'plans/my-plan') });

      const result = contextBuilder.buildReminderContext({
        sessionId,
        staticEnv: {},
        baseDir: tempDir
      });

      const reportLine = result.lines.find((l) => l.includes('- Report:'));
      assert.ok(reportLine, 'Should emit a Report naming line');
      assert.ok(
        reportLine.includes('reports/{type}-'),
        `Missing separator before {type}: ${reportLine}`
      );
    });

  });

  describe('Section builders', () => {

    it('wasRecentlyInjected detects the marker emitted by buildNamingSection', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-dedup-'));
      const transcript = path.join(tmpDir, 'transcript.jsonl');
      try {
        fs.writeFileSync(transcript, ['prior line', ...contextBuilder.buildNamingSection({ reportsPath: '/r/', plansPath: '/p', namePattern: '{slug}' })].join('\n'));
        assert.strictEqual(contextBuilder.wasRecentlyInjected(transcript), true);

        fs.writeFileSync(transcript, Array(10).fill('unrelated content').join('\n'));
        assert.strictEqual(contextBuilder.wasRecentlyInjected(transcript), false);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('buildPathsSection includes paths', () => {
      const lines = contextBuilder.buildPathsSection({
        reportsPath: '/test/reports/',
        plansPath: '/test/plans',
        docsPath: '/test/docs'
      });
      assert.ok(Array.isArray(lines), 'Should return array');
      assert.ok(lines.some(l => l.includes('Reports')), 'Should include Reports');
      assert.ok(lines.some(l => l.includes('Plans')), 'Should include Plans');
    });

    it('buildNamingSection includes naming patterns', () => {
      const lines = contextBuilder.buildNamingSection({
        reportsPath: '/reports/',
        plansPath: '/plans',
        namePattern: '{date}-{slug}'
      });
      assert.ok(Array.isArray(lines), 'Should return array');
      assert.ok(lines.some(l => l.includes('Naming')), 'Should include Naming');
    });

    it('buildNamingSection asks for a short plain slug', () => {
      const lines = contextBuilder.buildNamingSection({
        reportsPath: '/reports/',
        plansPath: '/plans',
        namePattern: '{date}-{slug}'
      });
      const slugLine = lines.find(l => l.startsWith('- Replace `{slug}`'));
      assert.ok(slugLine, 'Should emit a slug line');
      assert.match(slugLine, /short/, 'Should ask for a short slug');
      assert.doesNotMatch(slugLine, /descriptive/, 'Should not ask for a descriptive slug');
    });

  });

  describe('Export completeness', () => {

    it('exports all required functions', () => {
      const requiredExports = [
        'buildReminderContext',
        'buildReminder',
        'buildPathsSection',
        'buildPlanContextSection',
        'buildNamingSection',
        'buildPlanContext',
        'wasRecentlyInjected'
      ];

      for (const exportName of requiredExports) {
        assert.ok(typeof contextBuilder[exportName] === 'function',
          `Should export ${exportName}`);
      }
    });

  });

});
