#!/usr/bin/env node
/**
 * Tests for context-builder.cjs - rules/workflows backward compatibility
 * Run: node --test .claude/hooks/lib/__tests__/context-builder.test.cjs
 *
 * Issue #337: Rename workflows/ to rules/ with backward compatibility
 * Key scenarios:
 * - resolveRulesPath() checks rules/ first
 * - Falls back to workflows/ if rules/ not found
 * - resolveWorkflowPath alias works
 * - Both directories: rules/ wins
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

  describe('resolveRulesPath()', () => {
    let originalCwd;
    let tempDir;

    before(() => {
      originalCwd = process.cwd();
    });

    after(() => {
      process.chdir(originalCwd);
      if (tempDir) cleanupTempDir(tempDir);
    });

    it('returns null when file does not exist anywhere', () => {
      tempDir = createTempDir(['.claude']);
      process.chdir(tempDir);

      // Use a unique filename that won't exist in global ~/.claude/
      const uniqueFilename = `nonexistent-${Date.now()}-${Math.random().toString(36).slice(2)}.md`;
      const result = contextBuilder.resolveRulesPath(uniqueFilename);
      assert.strictEqual(result, null, 'Should return null when file does not exist');
    });

    it('finds file in rules/ directory (new location)', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const result = contextBuilder.resolveRulesPath('development-rules.md');
      assert.strictEqual(result, '.claude/rules/development-rules.md',
        'Should find file in rules/ directory');
    });

    it('falls back to workflows/ when rules/ does not exist', () => {
      tempDir = createTempDir(['.claude/workflows']);
      createTestFile(path.join(tempDir, '.claude/workflows'), 'development-rules.md');
      process.chdir(tempDir);

      const result = contextBuilder.resolveRulesPath('development-rules.md');
      assert.strictEqual(result, '.claude/workflows/development-rules.md',
        'Should fall back to workflows/ directory');
    });

    it('prefers rules/ over workflows/ when both exist', () => {
      tempDir = createTempDir(['.claude/rules', '.claude/workflows']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md', '# Rules version\n');
      createTestFile(path.join(tempDir, '.claude/workflows'), 'development-rules.md', '# Workflows version\n');
      process.chdir(tempDir);

      const result = contextBuilder.resolveRulesPath('development-rules.md');
      assert.strictEqual(result, '.claude/rules/development-rules.md',
        'Should prefer rules/ over workflows/');
    });

    it('finds file in workflows/ when rules/ exists but file is only in workflows/', () => {
      tempDir = createTempDir(['.claude/rules', '.claude/workflows']);
      // rules/ exists but file is only in workflows/
      createTestFile(path.join(tempDir, '.claude/workflows'), 'legacy-file.md');
      process.chdir(tempDir);

      const result = contextBuilder.resolveRulesPath('legacy-file.md');
      assert.strictEqual(result, '.claude/workflows/legacy-file.md',
        'Should find file in workflows/ when not in rules/');
    });


  });

  describe('resolveWorkflowPath alias', () => {

    it('resolveWorkflowPath is exported and callable', () => {
      assert.ok(typeof contextBuilder.resolveWorkflowPath === 'function',
        'resolveWorkflowPath should be exported');
    });

    it('resolveWorkflowPath is alias for resolveRulesPath', () => {
      assert.strictEqual(contextBuilder.resolveWorkflowPath, contextBuilder.resolveRulesPath,
        'resolveWorkflowPath should be same function as resolveRulesPath');
    });

    it('resolveWorkflowPath works identically to resolveRulesPath', () => {
      const tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'test.md');
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const rulesResult = contextBuilder.resolveRulesPath('test.md');
        const workflowResult = contextBuilder.resolveWorkflowPath('test.md');
        assert.strictEqual(rulesResult, workflowResult,
          'Both functions should return same result');
      } finally {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
      }
    });

  });

  describe('Global path resolution', () => {
    let tempDir;
    let originalHome;

    before(() => {
      originalHome = os.homedir;
    });

    after(() => {
      if (tempDir) cleanupTempDir(tempDir);
    });

    it('checks global ~/.claude/rules/ path', () => {
      // This test verifies the code path exists but we can't easily mock homedir
      // Just verify the function handles missing global paths gracefully
      const tempDir = createTempDir(['.claude']);
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        // Should return null since local doesn't exist and we can't control global
        const result = contextBuilder.resolveRulesPath('nonexistent-file.md');
        // Result depends on whether global ~/.claude/rules exists
        assert.ok(result === null || typeof result === 'string',
          'Should return null or valid path');
      } finally {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
      }
    });

  });

  describe('buildReminderContext()', () => {
    let tempDir;
    let originalCwd;

    before(() => {
      originalCwd = process.cwd();
    });

    after(() => {
      process.chdir(originalCwd);
      if (tempDir) cleanupTempDir(tempDir);
    });

    it('returns content, lines, and sections', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(result.content, 'Should have content');
      assert.ok(Array.isArray(result.lines), 'Should have lines array');
      assert.ok(result.sections, 'Should have sections object');
    });

    // Regression: every other case here omits baseDir, so the absolute-path branch went
    // untested — that blind spot is what let the reports-path prefix doubling ship.
    it('does not double baseDir in reports path when a plan is active', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const sessionId = 'ctx-builder-abs-plan-test';
      // set-active-plan.cjs stores the plan path absolute (Issue #335).
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

    it('includes devRulesPath when rules/ exists', () => {
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(result.content.includes('rules/development-rules.md') ||
                result.content.includes('development-rules'),
        'Should reference dev rules file');
    });

    it('includes devRulesPath when only workflows/ exists (backward compat)', () => {
      tempDir = createTempDir(['.claude/workflows']);
      createTestFile(path.join(tempDir, '.claude/workflows'), 'development-rules.md');
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(result.content.includes('workflows/development-rules.md') ||
                result.content.includes('development-rules'),
        'Should reference dev rules file from workflows/');
    });

  });

  describe('Section builders', () => {

    it('buildSessionSection returns array of lines', () => {
      const lines = contextBuilder.buildSessionSection({});
      assert.ok(Array.isArray(lines), 'Should return array');
      assert.ok(lines.some(l => l.includes('Session')), 'Should include Session header');
    });

    it('buildRulesSection returns array with Rules header', () => {
      const lines = contextBuilder.buildRulesSection({});
      assert.ok(Array.isArray(lines), 'Should return array');
      assert.ok(lines.some(l => l.includes('Rules')), 'Should include Rules header');
    });

    it('buildRulesSection uses absolute paths when provided (Issue #476)', () => {
      const lines = contextBuilder.buildRulesSection({
        plansPath: '/Users/test/project/plans',
        docsPath: '/Users/test/project/docs'
      });
      const joined = lines.join('\n');
      assert.ok(joined.includes('/Users/test/project/plans'), 'Should include absolute plans path');
      assert.ok(joined.includes('/Users/test/project/docs'), 'Should include absolute docs path');
      assert.ok(!joined.includes('Plans → "plans/"'), 'Should NOT use bare relative "plans/" when absolute path provided');
    });

    it('buildRulesSection falls back to relative when no paths provided (Issue #476)', () => {
      const lines = contextBuilder.buildRulesSection({});
      const joined = lines.join('\n');
      assert.ok(joined.includes('"plans"'), 'Should fall back to relative plans');
      assert.ok(joined.includes('"docs"'), 'Should fall back to relative docs');
    });

    it('buildModularizationSection returns array with Modularization', () => {
      const lines = contextBuilder.buildModularizationSection();
      assert.ok(Array.isArray(lines), 'Should return array');
      assert.ok(lines.some(l => l.includes('Modularization')), 'Should include Modularization');
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

  });

  describe('Hooks config behavior (Issue #413)', () => {
    let tempDir;
    let originalCwd;

    before(() => {
      originalCwd = process.cwd();
    });

    after(() => {
      process.chdir(originalCwd);
      if (tempDir) cleanupTempDir(tempDir);
    });

    it('disables context section when context-tracking: false', () => {
      tempDir = createTempDir(['.claude']);
      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          'context-tracking': false
        }
      }));
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(Array.isArray(result.sections.context), 'context should be array');
      assert.strictEqual(result.sections.context.length, 0, 'context section should be empty');
    });

    it('disables usage section when usage-context-awareness: false', () => {
      tempDir = createTempDir(['.claude']);
      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          'usage-context-awareness': false
        }
      }));
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(Array.isArray(result.sections.usage), 'usage should be array');
      assert.strictEqual(result.sections.usage.length, 0, 'usage section should be empty');
    });

    it('disables both sections when both hooks false', () => {
      tempDir = createTempDir(['.claude']);
      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          'context-tracking': false,
          'usage-context-awareness': false
        }
      }));
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.strictEqual(result.sections.context.length, 0, 'context section should be empty');
      assert.strictEqual(result.sections.usage.length, 0, 'usage section should be empty');
    });

    it('enables sections by default when hooks undefined', () => {
      tempDir = createTempDir(['.claude']);
      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify({}));
      process.chdir(tempDir);

      const result = contextBuilder.buildReminderContext({});

      assert.ok(Array.isArray(result.sections.context), 'context should be array');
      assert.ok(Array.isArray(result.sections.usage), 'usage should be array');
      // Enabled sections may be empty or populated - just verify they exist
    });

  });

  describe('Export completeness', () => {

    it('exports all required functions', () => {
      const requiredExports = [
        'buildReminderContext',
        'buildReminder',
        'buildLanguageSection',
        'buildSessionSection',
        'buildRulesSection',
        'buildModularizationSection',
        'buildPathsSection',
        'buildPlanContextSection',
        'buildNamingSection',
        'execSafe',
        'resolveRulesPath',
        'resolveScriptPath',
        'resolveSkillsVenv',
        'buildPlanContext',
        'wasRecentlyInjected',
        'resolveWorkflowPath' // Backward compat alias
      ];

      for (const exportName of requiredExports) {
        assert.ok(typeof contextBuilder[exportName] === 'function',
          `Should export ${exportName}`);
      }
    });

  });

  describe('CLAUDE.md reference resolution', () => {
    let tempDir;
    let originalCwd;

    before(() => {
      originalCwd = process.cwd();
    });

    after(() => {
      process.chdir(originalCwd);
      if (tempDir) cleanupTempDir(tempDir);
    });

    it('resolves @rules/ references correctly', () => {
      // This test verifies that the rules path resolution works
      // which is used by CLAUDE.md @references
      tempDir = createTempDir(['.claude/rules']);
      createTestFile(path.join(tempDir, '.claude/rules'), 'primary-workflow.md');
      createTestFile(path.join(tempDir, '.claude/rules'), 'development-rules.md');
      createTestFile(path.join(tempDir, '.claude/rules'), 'orchestration-protocol.md');
      createTestFile(path.join(tempDir, '.claude/rules'), 'documentation-management.md');
      process.chdir(tempDir);

      // All files referenced in CLAUDE.md should resolve
      const files = [
        'primary-workflow.md',
        'development-rules.md',
        'orchestration-protocol.md',
        'documentation-management.md'
      ];

      for (const file of files) {
        const result = contextBuilder.resolveRulesPath(file);
        assert.ok(result !== null, `Should resolve ${file}`);
        assert.ok(result.includes('rules/'), `${file} should be in rules/`);
      }
    });

    it('resolves legacy @workflows/ references via fallback', () => {
      // Test that legacy references still work
      tempDir = createTempDir(['.claude/workflows']);
      createTestFile(path.join(tempDir, '.claude/workflows'), 'primary-workflow.md');
      process.chdir(tempDir);

      const result = contextBuilder.resolveRulesPath('primary-workflow.md');
      assert.ok(result !== null, 'Should resolve legacy workflow file');
      assert.ok(result.includes('workflows/'), 'Should find in workflows/');
    });

  });

});
