#!/usr/bin/env node
/**
 * Integration: hooks run inside a linked git worktree.
 * Run: node --test .claude/hooks/__tests__/integration/worktree-plans-paths.test.cjs
 *
 * plans/ and reports resolve against the main worktree; docs/ stays with cwd.
 * Covers session-init, subagent-init, dev-rules-reminder and the Codex hooks.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createRepoWithWorktree } = require('../helpers/temp-git-worktree.cjs');

const CLAUDE_HOOKS = path.join(__dirname, '..', '..');
const CODEX_HOOKS = path.join(CLAUDE_HOOKS, '..', '..', '.codex', 'hooks');

/** Current month bucket, plus the previous/next candidate around a month rollover */
function monthBuckets() {
  const yymm = (d) => String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
  const now = new Date();
  return [yymm(now), yymm(new Date(now.getTime() + 60 * 1000)), yymm(new Date(now.getTime() - 60 * 1000))];
}

/** Assert `text` contains `prefix + <current month bucket> + suffix` */
function assertIncludesMonthBucket(text, prefix, suffix = '') {
  const found = monthBuckets().some((b) => text.includes(`${prefix}${b}${suffix}`));
  assert.ok(found, `Expected "${prefix}{YYMM}${suffix}" in:\n${text}`);
}

/** Create a plan dir with a plan.md (branch matching requires one) */
function makePlan(planDir) {
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(path.join(planDir, 'plan.md'), '# plan\n');
}

/** Spawn a hook script with JSON on stdin */
function runHook(hookPath, input, { cwd, env = {} }) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [hookPath], {
      cwd,
      // CK_SESSION_ID cleared so an outer Claude session's state never leaks in
      env: { ...process.env, CLAUDE_ENV_FILE: '', CK_SESSION_ID: '', CODEX_THREAD_ID: '', ...env }
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('timeout')); }, 15000);
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.stdin.end(JSON.stringify(input));
    proc.on('close', (code) => {
      clearTimeout(timer);
      let output = null;
      try { output = JSON.parse(stdout); } catch (e) { /* plain-text hooks */ }
      resolve({ stdout, stderr, exitCode: code, output });
    });
    proc.on('error', reject);
  });
}

describe('hooks inside a linked git worktree', () => {
  let repo;
  let plans;
  let docs;

  before(() => {
    repo = createRepoWithWorktree({ branch: 'feat/wt-test' });
    plans = path.join(repo.main, 'plans');
    docs = path.join(repo.worktree, 'docs');
  });

  after(() => repo.cleanup());

  it('session-init exports plans + reports under the main worktree, docs under cwd', async () => {
    const envFile = path.join(os.tmpdir(), `ck-env-${process.pid}-${Date.now()}`);
    try {
      const res = await runHook(path.join(CLAUDE_HOOKS, 'session-init.cjs'), { source: 'startup' }, {
        cwd: repo.worktree,
        env: { CLAUDE_ENV_FILE: envFile }
      });
      assert.strictEqual(res.exitCode, 0, res.stderr);
      const env = fs.readFileSync(envFile, 'utf8');
      assert.ok(env.includes(`export CK_PLANS_PATH="${plans}"`), env);
      assertIncludesMonthBucket(env, `export CK_REPORTS_PATH="${plans}/reports/`, '"');
      assert.ok(env.includes(`export CK_DOCS_PATH="${docs}"`), env);
      assert.ok(env.includes(`export CK_PROJECT_ROOT="${repo.worktree}"`), env);
    } finally {
      fs.rmSync(envFile, { force: true });
    }
  });

  it('subagent-init injects main-worktree plans/reports and cwd docs', async () => {
    const res = await runHook(path.join(CLAUDE_HOOKS, 'subagent-init.cjs'), {
      agent_type: 'tester', agent_id: 'wt-1', cwd: repo.worktree
    }, { cwd: repo.worktree });
    assert.strictEqual(res.exitCode, 0, res.stderr);
    const ctx = res.output.hookSpecificOutput.additionalContext;
    assertIncludesMonthBucket(ctx, `- Reports: ${plans}/reports/`);
    assert.ok(ctx.includes(`- Paths: ${plans}/ | ${docs}/`), ctx);
    assert.ok(ctx.includes(`- Plan dir: ${plans}/`), ctx);
    assertIncludesMonthBucket(ctx, `- Report: ${plans}/reports/`, '/tester-');
  });

  it('dev-rules-reminder points at main-worktree plans + reports, cwd docs', async () => {
    const res = await runHook(path.join(CLAUDE_HOOKS, 'dev-rules-reminder.cjs'), { user_prompt: 'hi' }, {
      cwd: repo.worktree
    });
    assert.strictEqual(res.exitCode, 0, res.stderr);
    assert.ok(res.stdout.includes(`Plans → "${plans}" directory, Docs → "${docs}" directory`), res.stdout);
    assertIncludesMonthBucket(res.stdout, `Reports: ${plans}/reports/`, '/');
    assert.ok(res.stdout.includes('with one of: researcher, brainstormer'), 'fixed report types listed');
  });

  it('a branch-matched plan in the main worktree receives reports from a linked worktree', async () => {
    const planDir = path.join(plans, '260929-1200-wt-test');
    makePlan(planDir);
    try {
      const res = await runHook(path.join(CLAUDE_HOOKS, 'subagent-init.cjs'), {
        agent_type: 'planner', agent_id: 'wt-2', cwd: repo.worktree
      }, { cwd: repo.worktree });
      const ctx = res.output.hookSpecificOutput.additionalContext;
      assert.ok(ctx.includes(`- Plan: ${planDir} (matched from branch)`), ctx);
      assert.ok(!ctx.includes('Suggested'), ctx);
      assert.ok(ctx.includes(`- Reports: ${planDir}/reports`), ctx);
    } finally {
      fs.rmSync(planDir, { recursive: true, force: true });
    }
  });

  it('codex session-init: plans + reports under main worktree, fixed report types', async () => {
    const res = await runHook(path.join(CODEX_HOOKS, 'session-init-codex.cjs'), { cwd: repo.worktree }, {
      cwd: repo.worktree
    });
    assert.strictEqual(res.exitCode, 0, res.stderr);
    const ctx = res.output.hookSpecificOutput.additionalContext;
    assertIncludesMonthBucket(ctx, `- Reports: ${plans}/reports/`, '/');
    assert.ok(ctx.includes(`- Plan dir: \`${plans}/`), ctx);
    assert.ok(ctx.includes('with one of: researcher, brainstormer'), ctx);
  });

  it('codex session-init: branch-matched plan reads as (matched from branch), no plan reads as none', async () => {
    const planDir = path.join(plans, '260929-1200-wt-test');
    const run = () => runHook(path.join(CODEX_HOOKS, 'session-init-codex.cjs'), { cwd: repo.worktree }, { cwd: repo.worktree });

    const none = (await run()).output.hookSpecificOutput.additionalContext;
    assert.ok(none.includes('- Active Plan: none'), none);
    // Dev Rules point at the resolved main-worktree plans dir, not a cwd-relative ./plans/
    assert.ok(none.includes(`- Plans: \`${plans}/\` directory`), none);
    assert.ok(!none.includes('`./plans/`'), none);

    makePlan(planDir);
    try {
      const ctx = (await run()).output.hookSpecificOutput.additionalContext;
      assert.ok(ctx.includes(`- Plan: ${planDir} (matched from branch)`), ctx);
      assert.ok(!ctx.includes('Suggested'), ctx);
    } finally {
      fs.rmSync(planDir, { recursive: true, force: true });
    }
  });

  it('codex dev-rules-reminder: branch-matched plan reports resolve in main worktree', async () => {
    const planDir = path.join(plans, '260929-1200-wt-test');
    makePlan(planDir);
    try {
      const res = await runHook(path.join(CODEX_HOOKS, 'dev-rules-reminder-codex.cjs'), { cwd: repo.worktree }, {
        cwd: repo.worktree
      });
      assert.strictEqual(res.exitCode, 0, res.stderr);
      const ctx = res.output.hookSpecificOutput.additionalContext;
      assert.ok(ctx.includes(`- Plan: ${planDir} (matched from branch)`), ctx);
      assert.ok(!ctx.includes('Suggested'), ctx);
      assert.ok(ctx.includes(`- Reports: ${planDir}/reports/`), ctx);
      assert.ok(ctx.includes(`- Plan dir: \`${plans}/`), ctx);
      assert.ok(ctx.includes('with one of: researcher, brainstormer'), ctx);
    } finally {
      fs.rmSync(planDir, { recursive: true, force: true });
    }
  });

  it('codex dev-rules-reminder: static reminder names the resolved plans path, not ./plans/', async () => {
    const res = await runHook(path.join(CODEX_HOOKS, 'dev-rules-reminder-codex.cjs'), { cwd: repo.worktree }, {
      cwd: repo.worktree
    });
    assert.strictEqual(res.exitCode, 0, res.stderr);
    const ctx = res.output.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes(`Plans → \`${plans}/\``), ctx);
    assert.ok(!ctx.includes('Plans → `./plans/`'), ctx);
    assert.ok(ctx.includes(`else \`${plans}/reports/{YYMM}/\``), ctx);
  });
});
