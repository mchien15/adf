#!/usr/bin/env node
/**
 * Tests for task-completed-handler.cjs hook
 * Run: node --test .claude/hooks/__tests__/task-completed-handler.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { writeSessionState, getSessionTempPath } = require('../lib/ck-config-utils.cjs');
const { createRepoWithWorktree } = require('./helpers/temp-git-worktree.cjs');

const HOOK_PATH = path.join(__dirname, '..', 'task-completed-handler.cjs');

/**
 * Execute hook with given stdin data and return parsed output
 */
function runHook(inputData, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], {
      cwd: options.cwd || process.cwd(),
      // CK_* cleared by default: an outer session's values must not steer where logs go
      env: { ...process.env, CK_REPORTS_PATH: '', CK_SESSION_ID: '', ...(options.env || {}) }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    if (inputData !== null && inputData !== undefined) {
      proc.stdin.write(typeof inputData === 'string' ? inputData : JSON.stringify(inputData));
    }
    proc.stdin.end();

    proc.on('close', (code) => {
      let output = null;
      try { output = JSON.parse(stdout); } catch { /* non-JSON ok */ }
      resolve({ stdout, stderr, exitCode: code, output });
    });

    proc.on('error', reject);
    setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('Timeout')); }, 10000);
  });
}

/**
 * Create temp team with task files for testing
 */
function createTestTeam(baseDir, teamName, tasks) {
  const taskDir = path.join(baseDir, '.claude', 'tasks', teamName);
  fs.mkdirSync(taskDir, { recursive: true });
  for (const task of tasks) {
    fs.writeFileSync(path.join(taskDir, `${task.id}.json`), JSON.stringify(task));
  }
  return taskDir;
}

describe('task-completed-handler.cjs', () => {

  describe('Fail-open behavior', () => {

    it('exits 0 on empty stdin', async () => {
      const result = await runHook(null);
      assert.strictEqual(result.exitCode, 0);
    });

    it('exits 0 on invalid JSON', async () => {
      const result = await runHook('not valid json{{{');
      assert.strictEqual(result.exitCode, 0);
    });

    it('exits 0 when no team_name in payload', async () => {
      const result = await runHook({ task_id: '1', teammate_name: 'worker' });
      assert.strictEqual(result.exitCode, 0);
    });

  });

  describe('Output format', () => {

    it('returns valid JSON with hookEventName = TaskCompleted', async () => {
      const tmpDir = path.join(os.tmpdir(), 'tc-hook-format-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        createTestTeam(tmpDir, 'test-team', [
          { id: '1', status: 'completed', subject: 'Task 1' },
          { id: '2', status: 'pending', subject: 'Task 2' }
        ]);

        const result = await runHook({
          task_id: '1', task_subject: 'Task 1',
          teammate_name: 'worker-1', team_name: 'test-team'
        }, { env: { HOME: tmpDir } });

        assert.strictEqual(result.exitCode, 0);
        assert.ok(result.output, 'Should return JSON');
        assert.strictEqual(result.output.hookSpecificOutput.hookEventName, 'TaskCompleted');
        assert.strictEqual(typeof result.output.hookSpecificOutput.additionalContext, 'string');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

  });

  describe('Progress counting', () => {

    it('includes correct progress counts', async () => {
      const tmpDir = path.join(os.tmpdir(), 'tc-hook-count-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        createTestTeam(tmpDir, 'count-team', [
          { id: '1', status: 'completed', subject: 'Done 1' },
          { id: '2', status: 'completed', subject: 'Done 2' },
          { id: '3', status: 'in_progress', subject: 'Working' },
          { id: '4', status: 'pending', subject: 'Todo' }
        ]);

        const result = await runHook({
          task_id: '2', task_subject: 'Done 2',
          teammate_name: 'dev-1', team_name: 'count-team'
        }, { env: { HOME: tmpDir } });

        const ctx = result.output.hookSpecificOutput.additionalContext;
        assert.ok(ctx.includes('2/4 done'), 'Should show 2/4 completed');
        assert.ok(ctx.includes('1 pending'), 'Should show 1 pending');
        assert.ok(ctx.includes('1 in progress'), 'Should show 1 in progress');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('includes "All tasks completed" when all done', async () => {
      const tmpDir = path.join(os.tmpdir(), 'tc-hook-alldone-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        createTestTeam(tmpDir, 'done-team', [
          { id: '1', status: 'completed', subject: 'A' },
          { id: '2', status: 'completed', subject: 'B' }
        ]);

        const result = await runHook({
          task_id: '2', task_subject: 'B',
          teammate_name: 'dev-1', team_name: 'done-team'
        }, { env: { HOME: tmpDir } });

        const ctx = result.output.hookSpecificOutput.additionalContext;
        assert.ok(ctx.includes('All tasks completed'), 'Should indicate all done');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

  });

  describe('Completion logging', () => {

    /** Current month bucket, plus neighbours within a minute of a month rollover */
    function monthBuckets() {
      const yymm = (d) => String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
      const now = Date.now();
      return [...new Set([yymm(new Date(now)), yymm(new Date(now + 60000)), yymm(new Date(now - 60000))])];
    }

    /** Find the completions log under `<base>/<bucket>/` for any current month bucket */
    function findBucketLog(base, teamName) {
      return monthBuckets()
        .map((b) => path.join(base, b, `team-${teamName}-completions.md`))
        .find((f) => fs.existsSync(f));
    }

    function setup(prefix) {
      const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
      const project = path.join(tmpDir, 'project');
      fs.mkdirSync(project, { recursive: true });
      return { tmpDir, project };
    }

    const completion = (team, sessionId) => ({
      task_id: '1', task_subject: 'Logged task', teammate_name: 'worker-1', team_name: team, session_id: sessionId
    });

    it('logs to the month bucket under the plans dir when no plan is active', async () => {
      const { tmpDir, project } = setup('tc-hook-log-');
      try {
        createTestTeam(tmpDir, 'log-team', [{ id: '1', status: 'completed', subject: 'Logged task' }]);

        // CK_REPORTS_PATH (captured at session start) marks a CK session but is not trusted
        const stale = path.join(tmpDir, 'stale', 'reports');
        await runHook(completion('log-team'), { cwd: project, env: { HOME: tmpDir, CK_REPORTS_PATH: stale } });

        const logFile = findBucketLog(path.join(project, 'plans', 'reports'), 'log-team');
        assert.ok(logFile, 'Log file should be under plans/reports/{YYMM}/');
        const content = fs.readFileSync(logFile, 'utf-8');
        assert.ok(content.includes('Logged task'), 'Should contain task subject');
        assert.ok(content.includes('worker-1'), 'Should contain teammate name');
        assert.ok(!fs.existsSync(stale), 'Stale env path must not be used');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('logs into the active plan reports dir while the plan exists', async () => {
      const { tmpDir, project } = setup('tc-hook-live-');
      const sessionId = `tc-live-${process.pid}-${Date.now()}`;
      try {
        createTestTeam(tmpDir, 'live-team', [{ id: '1', status: 'completed', subject: 'Logged task' }]);
        const planDir = path.join(project, 'plans', '260929-1200-live');
        fs.mkdirSync(planDir, { recursive: true });
        writeSessionState(sessionId, { activePlan: planDir, sessionOrigin: project, timestamp: Date.now() });

        await runHook(completion('live-team', sessionId), {
          cwd: project, env: { HOME: tmpDir, CK_REPORTS_PATH: path.join(planDir, 'reports') }
        });

        assert.ok(fs.existsSync(path.join(planDir, 'reports', 'team-live-team-completions.md')));
      } finally {
        fs.rmSync(getSessionTempPath(sessionId), { force: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('does not recreate the reports dir of a plan archived mid-session', async () => {
      const { tmpDir, project } = setup('tc-hook-archived-');
      const sessionId = `tc-archived-${process.pid}-${Date.now()}`;
      try {
        createTestTeam(tmpDir, 'arch-team', [{ id: '1', status: 'completed', subject: 'Logged task' }]);
        const gonePlan = path.join(project, 'plans', '260101-0000-archived');
        writeSessionState(sessionId, { activePlan: gonePlan, sessionOrigin: project, timestamp: Date.now() });

        // env still holds the path captured at session start, before the archive
        await runHook(completion('arch-team', sessionId), {
          cwd: project, env: { HOME: tmpDir, CK_REPORTS_PATH: path.join(gonePlan, 'reports') }
        });

        assert.ok(!fs.existsSync(gonePlan), 'archived plan dir must not be recreated');
        assert.ok(findBucketLog(path.join(project, 'plans', 'reports'), 'arch-team'), 'falls back to the month bucket');
      } finally {
        fs.rmSync(getSessionTempPath(sessionId), { force: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('logs under the main worktree plans dir when run in a linked worktree', async () => {
      const repo = createRepoWithWorktree();
      const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tc-hook-wt-')));
      try {
        createTestTeam(tmpDir, 'wt-team', [{ id: '1', status: 'completed', subject: 'Logged task' }]);

        await runHook(completion('wt-team'), {
          cwd: repo.worktree, env: { HOME: tmpDir, CK_REPORTS_PATH: 'set' }
        });

        assert.ok(findBucketLog(path.join(repo.main, 'plans', 'reports'), 'wt-team'), 'log lands in main worktree');
        assert.ok(!fs.existsSync(path.join(repo.worktree, 'plans')), 'no plans/ created in the linked worktree');
      } finally {
        repo.cleanup();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('does not crash when CK_REPORTS_PATH is unset', async () => {
      const tmpDir = path.join(os.tmpdir(), 'tc-hook-nolog-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        createTestTeam(tmpDir, 'nolog-team', [
          { id: '1', status: 'completed', subject: 'A' }
        ]);

        const result = await runHook({
          task_id: '1', task_subject: 'A',
          teammate_name: 'w', team_name: 'nolog-team'
        }, { env: { HOME: tmpDir, CK_REPORTS_PATH: '' } });

        assert.strictEqual(result.exitCode, 0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

  });

  describe('Error resilience', () => {

    it('handles missing task directory gracefully', async () => {
      const tmpDir = path.join(os.tmpdir(), 'tc-hook-nodir-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        // No task dir created
        const result = await runHook({
          task_id: '1', task_subject: 'X',
          teammate_name: 'w', team_name: 'missing-team'
        }, { env: { HOME: tmpDir } });

        assert.strictEqual(result.exitCode, 0);
        assert.ok(result.output, 'Should still return JSON');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('handles corrupted task JSON gracefully', async () => {
      const tmpDir = path.join(os.tmpdir(), 'tc-hook-corrupt-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        const taskDir = path.join(tmpDir, '.claude', 'tasks', 'bad-team');
        fs.mkdirSync(taskDir, { recursive: true });
        fs.writeFileSync(path.join(taskDir, '1.json'), '{bad json{{{');
        fs.writeFileSync(path.join(taskDir, '2.json'), JSON.stringify({ id: '2', status: 'pending', subject: 'OK' }));

        const result = await runHook({
          task_id: '1', task_subject: 'X',
          teammate_name: 'w', team_name: 'bad-team'
        }, { env: { HOME: tmpDir } });

        assert.strictEqual(result.exitCode, 0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

  });

});
