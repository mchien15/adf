#!/usr/bin/env node
/**
 * Plans root + reports routing (clean plans/reports layout, phase 1).
 * Run: node --test .claude/hooks/__tests__/plans-root-resolution.test.cjs
 *
 * - resolvePlansBaseDir: one plans/ per repo across linked git worktrees
 * - getReportsPath: plan reports for session/branch plans, month bucket otherwise
 * - resolvePlanPath: branch match finds the plan in the main worktree, matches strictly
 *   (reserved dirs, plan.md, slug suffix), and ignores an active plan whose dir is gone
 * - fixed report types in the Naming section
 * - buildReminderContext: plans/reports under main worktree, docs under cwd
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const childProcess = require('child_process');
const {
  DEFAULT_CONFIG,
  REPORT_TYPES,
  resolvePlansBaseDir,
  getReportsPath,
  resolvePlanPath,
  resolveSessionPlanPath,
  resolveCurrentReportsPath,
  RESERVED_PLAN_DIRS,
  writeSessionState,
  getSessionTempPath
} = require('../lib/ck-config-utils.cjs');
const { buildReminderContext, buildNamingSection } = require('../lib/context-builder.cjs');
const { createRepoWithWorktree, createPlainRepo, withMonthBuckets, git } = require('./helpers/temp-git-worktree.cjs');

const planConfig = { reportsDir: 'reports' };
const pathsConfig = { plans: 'plans' };

/** Create a plan dir with a plan.md (what a real plan looks like) */
function makePlan(plansDir, name) {
  fs.mkdirSync(path.join(plansDir, name), { recursive: true });
  fs.writeFileSync(path.join(plansDir, name, 'plan.md'), '# plan\n');
}

/** Run fn with child_process.execSync wrapped; returns the commands that ran */
function recordGitCommands(fn) {
  const original = childProcess.execSync;
  const commands = [];
  childProcess.execSync = (cmd, ...rest) => { commands.push(String(cmd)); return original(cmd, ...rest); };
  try { fn(); } finally { childProcess.execSync = original; }
  return commands;
}

/** Assert `actual` equals one of the candidate values built per month bucket */
function assertOneOfBuckets(actual, buckets, build) {
  const candidates = buckets.map(build);
  assert.ok(candidates.includes(actual), `${actual} not in ${JSON.stringify(candidates)}`);
}

describe('resolvePlansBaseDir', () => {
  let plain;
  let linked;
  let nonGit;

  before(() => {
    plain = createPlainRepo();
    fs.mkdirSync(path.join(plain.main, 'packages', 'api'), { recursive: true });
    linked = createRepoWithWorktree();
    fs.mkdirSync(path.join(linked.worktree, 'packages', 'api'), { recursive: true });
    nonGit = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-plans-nogit-')));
  });

  after(() => {
    plain.cleanup();
    linked.cleanup();
    fs.rmSync(nonGit, { recursive: true, force: true });
  });

  it('returns cwd unchanged at the root of a normal repo', () => {
    assert.strictEqual(resolvePlansBaseDir(plain.main), plain.main);
  });

  it('returns cwd unchanged in a subdirectory of a normal repo (Issue #327)', () => {
    const sub = path.join(plain.main, 'packages', 'api');
    assert.strictEqual(resolvePlansBaseDir(sub), sub);
  });

  it('returns cwd unchanged in the main worktree even when linked worktrees exist', () => {
    assert.strictEqual(resolvePlansBaseDir(linked.main), linked.main);
  });

  it('maps a linked worktree root onto the main worktree root', () => {
    assert.strictEqual(resolvePlansBaseDir(linked.worktree), linked.main);
  });

  it('keeps the relative subdirectory when mapping a linked worktree subdir', () => {
    const sub = path.join(linked.worktree, 'packages', 'api');
    assert.strictEqual(resolvePlansBaseDir(sub), path.join(linked.main, 'packages', 'api'));
  });

  it('returns cwd for a directory outside any git repo', () => {
    assert.strictEqual(resolvePlansBaseDir(nonGit), nonGit);
  });

  it('returns cwd when the directory does not exist', () => {
    const missing = path.join(nonGit, 'does-not-exist');
    assert.strictEqual(resolvePlansBaseDir(missing), missing);
  });
});

describe('getReportsPath routing', () => {
  it('session plan -> {plan}/reports', () => {
    assert.strictEqual(getReportsPath('plans/my-plan', 'session', planConfig, pathsConfig), 'plans/my-plan/reports/');
  });

  it('branch-matched plan -> {plan}/reports', () => {
    assert.strictEqual(getReportsPath('plans/my-plan', 'branch', planConfig, pathsConfig), 'plans/my-plan/reports/');
  });

  it('branch-matched absolute plan with baseDir stays under the plan', () => {
    const result = getReportsPath('/main/plans/my-plan', 'branch', planConfig, pathsConfig, '/wt');
    assert.strictEqual(result, '/main/plans/my-plan/reports');
  });

  it('no plan -> plans/reports/{YYMM}/ (relative form keeps trailing slash)', () => {
    const { result, buckets } = withMonthBuckets(() => getReportsPath(null, null, planConfig, pathsConfig));
    assertOneOfBuckets(result, buckets, (b) => `plans/reports/${b}/`);
  });

  it('no plan with baseDir -> absolute plans/reports/{YYMM}', () => {
    const { result, buckets } = withMonthBuckets(() => getReportsPath(null, null, planConfig, pathsConfig, '/project'));
    assertOneOfBuckets(result, buckets, (b) => `/project/plans/reports/${b}`);
  });

  it('whitespace-only plan path falls back to the month bucket', () => {
    const { result, buckets } = withMonthBuckets(() => getReportsPath('   ', 'session', planConfig, pathsConfig));
    assertOneOfBuckets(result, buckets, (b) => `plans/reports/${b}/`);
  });
});

describe('resolvePlanPath branch lookup', () => {
  const config = { paths: { plans: 'plans' }, plan: { resolution: { order: ['branch'] } } };
  let linked;
  let plain;
  const planName = '260929-1200-my-feature';

  before(() => {
    linked = createRepoWithWorktree({ branch: 'feat/my-feature' });
    // plans/ exists only in the main worktree (gitignored in real projects)
    makePlan(path.join(linked.main, 'plans'), planName);

    plain = createPlainRepo();
    git(plain.main, 'checkout', '-q', '-b', 'feat/normal-thing');
    makePlan(path.join(plain.main, 'plans'), '260929-1200-normal-thing');
  });

  after(() => {
    linked.cleanup();
    plain.cleanup();
  });

  it('finds a branch-matched plan in the main worktree from inside a linked worktree', () => {
    const result = resolvePlanPath(null, config, linked.worktree);
    assert.deepStrictEqual(result, { path: path.join(linked.main, 'plans', planName), resolvedBy: 'branch' });
  });

  it('keeps the relative plan path in a normal repo', () => {
    const result = resolvePlanPath(null, config, plain.main);
    assert.deepStrictEqual(result, { path: path.join('plans', '260929-1200-normal-thing'), resolvedBy: 'branch' });
  });
});

describe('resolvePlanPath branch matching is strict', () => {
  const config = { paths: { plans: 'plans' }, plan: { resolution: { order: ['branch'] } } };
  let repo;
  let counter = 0;

  before(() => { repo = createPlainRepo(); });
  after(() => repo.cleanup());

  const created = [];

  /** Fresh plans/ + linked worktree on `branch` per case; earlier cases are torn down first */
  function setup(branch, plans) {
    while (created.length) {
      const prev = created.pop();
      git(repo.main, 'worktree', 'remove', '--force', prev.dir);
      git(repo.main, 'branch', '-D', prev.branch);
    }
    counter += 1;
    const dir = path.join(repo.root, `case-${counter}`);
    git(repo.main, 'worktree', 'add', '-q', dir, '-b', branch);
    created.push({ dir, branch });
    // the case dir is a linked worktree, so plans/ resolves to the main worktree
    fs.rmSync(path.join(repo.main, 'plans'), { recursive: true, force: true });
    for (const name of plans) {
      if (typeof name === 'string') makePlan(path.join(repo.main, 'plans'), name);
      else fs.mkdirSync(path.join(repo.main, 'plans', name.bare), { recursive: true });
    }
    return dir;
  }

  it('branch fix/reports does not match the plans/reports bucket dir', () => {
    const dir = setup('fix/reports', [{ bare: 'reports/2609' }, 'reports']);
    assert.deepStrictEqual(resolvePlanPath(null, config, dir), { path: null, resolvedBy: null });
  });

  it('branch chore/archive does not match plans/archive', () => {
    const dir = setup('chore/archive', [{ bare: 'archive/2609' }, 'archive']);
    assert.deepStrictEqual(resolvePlanPath(null, config, dir), { path: null, resolvedBy: null });
  });

  it('skips templates/ and visuals/ even when they hold a plan.md', () => {
    const dir = setup('docs/templates', ['templates', 'visuals']);
    assert.strictEqual(resolvePlanPath(null, config, dir).path, null);
    const dir2 = setup('docs/visuals', ['visuals']);
    assert.strictEqual(resolvePlanPath(null, config, dir2).path, null);
  });

  it('requires a plan.md inside the dir', () => {
    const dir = setup('feat/no-plan-md', [{ bare: '260929-1200-no-plan-md' }]);
    assert.strictEqual(resolvePlanPath(null, config, dir).path, null);
  });

  it('matches by slug suffix, not by substring', () => {
    const dir = setup('feat/ui', ['260929-1200-build-ui-kit', '260929-1200-oauth-flow', '260929-1200-guix']);
    assert.strictEqual(resolvePlanPath(null, config, dir).path, null);
    const dir2 = setup('feat/auth', ['260929-1200-oauth', '260929-1200-auth']);
    assert.strictEqual(resolvePlanPath(null, config, dir2).path, path.join(repo.main, 'plans', '260929-1200-auth'));
  });

  it('matches a dir named exactly as the slug', () => {
    const dir = setup('feat/auth', ['auth']);
    assert.strictEqual(resolvePlanPath(null, config, dir).path, path.join(repo.main, 'plans', 'auth'));
  });

  it('picks the latest of several matches regardless of readdir order', () => {
    const dir = setup('feat/auth', ['261001-0900-auth', '260929-1000-auth', '260930-1000-auth']);
    assert.strictEqual(resolvePlanPath(null, config, dir).path, path.join(repo.main, 'plans', '261001-0900-auth'));
  });

  it('does not resolve the plans base when the branch yields no slug', () => {
    const plain = createPlainRepo(); // default branch (main/master): no feat/ prefix -> no slug
    try {
      const commands = recordGitCommands(() => resolvePlanPath(null, config, plain.main));
      assert.deepStrictEqual(commands.filter((c) => c.includes('--git-common-dir')), []);
    } finally {
      plain.cleanup();
    }
  });
});

describe('active (session) plan whose dir no longer exists', () => {
  const sessions = [];
  let repo;

  before(() => {
    repo = createPlainRepo();
    git(repo.main, 'checkout', '-q', '-b', 'feat/still-here');
    makePlan(path.join(repo.main, 'plans'), '260929-1200-still-here');
  });

  after(() => {
    repo.cleanup();
    for (const id of sessions) fs.rmSync(getSessionTempPath(id), { force: true });
  });

  function sessionWithPlan(activePlan) {
    const id = `plans-root-test-${process.pid}-${sessions.length}-${Date.now()}`;
    sessions.push(id);
    writeSessionState(id, { activePlan, sessionOrigin: repo.main, timestamp: Date.now() });
    return id;
  }

  it('still resolves an active plan whose dir exists', () => {
    const planDir = path.join(repo.main, 'plans', '260929-1200-still-here');
    const config = { paths: { plans: 'plans' }, plan: { resolution: { order: ['session'] } } };
    assert.deepStrictEqual(resolvePlanPath(sessionWithPlan(planDir), config, repo.main), { path: planDir, resolvedBy: 'session' });
  });

  it('falls through when the active plan dir was archived/removed', () => {
    const gone = path.join(repo.main, 'plans', '260101-0000-archived');
    const config = { paths: { plans: 'plans' }, plan: { resolution: { order: ['session'] } } };
    assert.deepStrictEqual(resolvePlanPath(sessionWithPlan(gone), config, repo.main), { path: null, resolvedBy: null });
  });

  it('falls through to the branch match when the active plan dir is gone', () => {
    const gone = path.join(repo.main, 'plans', '260101-0000-archived');
    const config = { paths: { plans: 'plans' }, plan: { resolution: { order: ['session', 'branch'] } } };
    const result = resolvePlanPath(sessionWithPlan(gone), config, repo.main);
    assert.strictEqual(result.resolvedBy, 'branch');
    assert.strictEqual(result.path, path.join('plans', '260929-1200-still-here'));
  });

  it('resolveSessionPlanPath returns the plan when present, null when gone or no session', () => {
    const planDir = path.join(repo.main, 'plans', '260929-1200-still-here');
    assert.strictEqual(resolveSessionPlanPath(sessionWithPlan(planDir)), planDir);
    assert.strictEqual(resolveSessionPlanPath(sessionWithPlan(path.join(repo.main, 'plans', 'nope'))), null);
    assert.strictEqual(resolveSessionPlanPath(null), null);
  });

  it('resolveSessionPlanPath ignores the git branch (session plans only)', () => {
    const id = `plans-root-test-nostate-${process.pid}-${Date.now()}`;
    assert.strictEqual(resolveSessionPlanPath(id), null);
  });
});

describe('RESERVED_PLAN_DIRS', () => {
  it('is one frozen list of the non-plan dirs under plans/', () => {
    assert.deepStrictEqual([...RESERVED_PLAN_DIRS], ['reports', 'archive', 'templates', 'visuals']);
    assert.ok(Object.isFrozen(RESERVED_PLAN_DIRS));
  });
});

describe('resolveCurrentReportsPath (run-time re-resolution)', () => {
  const sessions = [];
  let plain;
  let linked;

  before(() => {
    plain = createPlainRepo();
    linked = createRepoWithWorktree();
  });

  after(() => {
    plain.cleanup();
    linked.cleanup();
    for (const id of sessions) fs.rmSync(getSessionTempPath(id), { force: true });
  });

  function session(activePlan, origin) {
    const id = `reports-path-test-${process.pid}-${sessions.length}-${Date.now()}`;
    sessions.push(id);
    writeSessionState(id, { activePlan, sessionOrigin: origin, timestamp: Date.now() });
    return id;
  }

  it('no plan -> absolute plans/reports/{YYMM} under the plans base', () => {
    const { result, buckets } = withMonthBuckets(() => resolveCurrentReportsPath(null, plain.main));
    assertOneOfBuckets(result, buckets, (b) => path.join(plain.main, 'plans', 'reports', b));
  });

  it('live session plan -> {plan}/reports', () => {
    const planDir = path.join(plain.main, 'plans', '260929-1200-live');
    fs.mkdirSync(planDir, { recursive: true });
    assert.strictEqual(resolveCurrentReportsPath(session(planDir, plain.main), plain.main), path.join(planDir, 'reports'));
  });

  it('archived session plan -> month bucket, never the archived plan reports dir', () => {
    const gone = path.join(plain.main, 'plans', '260101-0000-archived');
    const { result, buckets } = withMonthBuckets(() => resolveCurrentReportsPath(session(gone, plain.main), plain.main));
    assertOneOfBuckets(result, buckets, (b) => path.join(plain.main, 'plans', 'reports', b));
  });

  it('linked worktree -> month bucket under the main worktree plans dir', () => {
    const { result, buckets } = withMonthBuckets(() => resolveCurrentReportsPath(null, linked.worktree));
    assertOneOfBuckets(result, buckets, (b) => path.join(linked.main, 'plans', 'reports', b));
  });
});

describe('resolvePlansBaseDir memoization', () => {
  it('runs git once per cwd within a process', () => {
    const repo = createPlainRepo();
    try {
      const commands = recordGitCommands(() => {
        resolvePlansBaseDir(repo.main);
        resolvePlansBaseDir(repo.main);
        resolvePlansBaseDir(repo.main);
      });
      assert.strictEqual(commands.filter((c) => c.includes('--git-common-dir')).length, 1);
    } finally {
      repo.cleanup();
    }
  });
});

describe('buildContextOutput plan label (session-init banner)', () => {
  const { buildContextOutput } = require('../lib/project-detector.cjs');
  const detections = { type: 'single-repo', pm: null };
  const cfg = { plan: { namingFormat: '{date}-{slug}' } };

  it('shows a session plan as Plan: <path>', () => {
    const out = buildContextOutput(cfg, detections, { path: '/p/plans/x', resolvedBy: 'session' }, null);
    assert.ok(out.includes('Plan: /p/plans/x'), out);
    assert.ok(!out.includes('matched from branch'), out);
  });

  it('shows a branch-matched plan as <path> (matched from branch), not Suggested', () => {
    const out = buildContextOutput(cfg, detections, { path: '/p/plans/x', resolvedBy: 'branch' }, null);
    assert.ok(out.includes('Plan: /p/plans/x (matched from branch)'), out);
    assert.ok(!out.includes('Suggested'), out);
  });

  it('shows nothing when no plan resolved', () => {
    const out = buildContextOutput(cfg, detections, { path: null, resolvedBy: null }, null);
    assert.ok(!out.includes('Plan:'), out);
  });
});

describe('fixed report types', () => {
  const expected = [
    'researcher', 'brainstormer', 'scout', 'planner', 'tester',
    'debugger', 'code-reviewer', 'docs-manager', 'project-manager', 'audit',
    'fullstack-developer', 'ui-ux-designer', 'business-analyst', 'testcase-writer'
  ];

  it('REPORT_TYPES is the fixed list', () => {
    assert.deepStrictEqual([...REPORT_TYPES], expected);
  });

  it('buildNamingSection lists the fixed types instead of free text', () => {
    const lines = buildNamingSection({ reportsPath: '/r/', plansPath: '/p', namePattern: '260101-0000-{slug}' });
    assert.ok(
      lines.includes(`- Replace \`{type}\` with one of: ${expected.join(', ')}`),
      `Naming lines: ${JSON.stringify(lines)}`
    );
    assert.ok(!lines.some((l) => l.includes('agent name, report type, or context')), 'free-text hint removed');
  });
});

describe('buildReminderContext inside a linked worktree', () => {
  let linked;
  let originalCwd;

  before(() => {
    linked = createRepoWithWorktree();
    originalCwd = process.cwd();
  });

  after(() => {
    process.chdir(originalCwd);
    linked.cleanup();
  });

  it('puts plans and month-bucket reports under the main worktree, docs under cwd', () => {
    const { result: ctx, buckets } = withMonthBuckets(() =>
      buildReminderContext({ config: DEFAULT_CONFIG, baseDir: linked.worktree })
    );
    const plans = path.join(linked.main, 'plans');
    const docs = path.join(linked.worktree, 'docs');

    assert.ok(ctx.content.includes(`Plans → "${plans}" directory, Docs → "${docs}" directory`), ctx.content);
    assertOneOfBuckets(
      ctx.sections.paths[1],
      buckets,
      (b) => `Reports: ${plans}/reports/${b}/ | Plans: ${plans}/ | Docs: ${docs}/ | docs.maxLoc: 800`
    );
    assert.ok(ctx.sections.naming.some((l) => l.startsWith(`- Plan dir: \`${plans}/`)), ctx.sections.naming.join('\n'));
  });

  it('uses the main worktree plans path even without baseDir when cwd is a linked worktree', () => {
    process.chdir(linked.worktree);
    const ctx = buildReminderContext({ config: DEFAULT_CONFIG });
    assert.ok(
      ctx.content.includes(`Plans → "${path.join(linked.main, 'plans')}" directory`),
      ctx.content
    );
  });

  it('labels a branch-matched plan as the plan, not as none', () => {
    const planDir = path.join(linked.main, 'plans', '260929-1200-wt-test');
    makePlan(path.join(linked.main, 'plans'), '260929-1200-wt-test');
    try {
      const ctx = buildReminderContext({ config: DEFAULT_CONFIG, baseDir: linked.worktree });
      assert.ok(ctx.sections.planContext.includes(`- Plan: ${planDir} (matched from branch)`), ctx.sections.planContext.join('\n'));
      assert.ok(!ctx.content.includes('Suggested'), 'no "Suggested" wording');
      assert.ok(!ctx.content.includes('- Plan: none'), 'branch-matched plan is not "none"');
    } finally {
      fs.rmSync(planDir, { recursive: true, force: true });
    }
  });

  it('keeps the dedup marker in the rules section', () => {
    const ctx = buildReminderContext({ config: DEFAULT_CONFIG, baseDir: linked.worktree });
    assert.ok(ctx.content.includes('Markdown files are organized in: Plans →'));
  });
});
