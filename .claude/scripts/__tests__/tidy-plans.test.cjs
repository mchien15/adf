'use strict';
/**
 * Tests for .claude/scripts/tidy-plans.cjs
 * Runs the real CLI against temp fixtures (real `git init` + `git worktree add` for merge cases).
 * Run: node --test .claude/scripts/__tests__/tidy-plans.test.cjs
 */
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'tidy-plans.cjs');

let tmp;
let home; // empty HOME so the user's real global config never leaks into a run
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tidy-plans-')));
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tidy-plans-home-')));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

/** Write a file under tmp (creating parents); returns absolute path. */
function write(rel, content = 'x') {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}
/** Create plans/<name>/plan.md with the given status line value. */
function plan(name, status) {
  return write(`plans/${name}/plan.md`, `---\ntitle: t\nstatus: ${status}\n---\n# t\n`);
}
/** Run the CLI; --root tmp is added unless args already carry one or start with `archive`. */
function run(args, { cwd = tmp, root = true } = {}) {
  const full = root && args[0] !== 'archive' && !args.includes('--root') ? [...args, '--root', tmp] : args;
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const r = spawnSync(process.execPath, [SCRIPT, ...full], { cwd, encoding: 'utf8', env });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
/** Sorted "relative/path=content" snapshot of every file (and dir) under dir. */
function snapshot(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out.push(path.relative(dir, p) + '/'); walk(p); }
      else out.push(path.relative(dir, p) + '=' + fs.readFileSync(p, 'utf8'));
    }
  })(dir);
  return out.sort();
}
const exists = (rel) => fs.existsSync(path.join(tmp, rel));
const read = (rel) => fs.readFileSync(path.join(tmp, rel), 'utf8');
const PYC_DIR = ['__py', 'cache__'].join(''); // keep the literal out of shell-visible text

describe('junk + dry-run default', () => {
  function messy() {
    plan('260925-1455-a', 'pending');
    write(`plans/260925-1455-a/${PYC_DIR}/x.cpython-312.pyc`);
    write('plans/.DS_Store');
    write('plans/reports/stale.pyc');
    write('plans/260925-1455-a/notes.md', 'keep');
  }

  test('dry-run lists junk removals and changes nothing', () => {
    messy();
    const before = snapshot(tmp);
    const r = run([]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /remove \(3\)/);
    assert.ok(r.out.includes(PYC_DIR));
    assert.match(r.out, /dry-run: 3 actions, re-run with --apply/);
    assert.deepEqual(snapshot(tmp), before);
  });

  test('--apply deletes junk only', () => {
    messy();
    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /applied 3 actions/);
    assert.ok(!exists(`plans/260925-1455-a/${PYC_DIR}`));
    assert.ok(!exists('plans/.DS_Store'));
    assert.ok(!exists('plans/reports/stale.pyc'));
    assert.ok(exists('plans/260925-1455-a/notes.md'));
    assert.ok(exists('plans/260925-1455-a/plan.md'));
  });

  test('missing plans dir exits 1 with message', () => {
    const r = run([]);
    assert.equal(r.code, 1);
    assert.match(r.err, /plans dir not found/);
  });

  test('unknown option exits 1', () => {
    plan('260925-1455-a', 'pending');
    const r = run(['--bogus']);
    assert.equal(r.code, 1);
    assert.match(r.err, /unknown option/);
  });
});

describe('normalize status', () => {
  // date-less dir names: normalized plans stay put (archiving needs a date prefix)
  for (const raw of ['done', 'complete', 'implemented', '"implemented', "'done'"]) {
    test(`${raw} -> completed (dry-run reports, apply rewrites)`, () => {
      const file = plan('legacy-plan', raw);
      const before = fs.readFileSync(file, 'utf8');
      const dry = run([]);
      assert.equal(dry.code, 0, dry.err);
      assert.match(dry.out, /normalize-status \(1\)/);
      assert.match(dry.out, /dry-run: 1 actions/);
      assert.equal(fs.readFileSync(file, 'utf8'), before);

      const applied = run(['--apply']);
      assert.equal(applied.code, 0, applied.err);
      assert.equal(fs.readFileSync(file, 'utf8'), '---\ntitle: t\nstatus: completed\n---\n# t\n');
    });
  }

  const CASES = [['Completed', 'completed'], ['In-Progress', 'in-progress'], ['PENDING', 'pending'], ['Done', 'completed'], ['"Cancelled"', 'cancelled']];
  for (const [raw, want] of CASES) {
    test(`${raw} is matched case-insensitively and rewritten to ${want}`, () => {
      const file = plan('legacy-case', raw);
      const dry = run([]);
      assert.match(dry.out, /normalize-status \(1\)/);
      assert.doesNotMatch(dry.out, /unknown-status/);
      run(['--apply']);
      assert.equal(fs.readFileSync(file, 'utf8'), `---\ntitle: t\nstatus: ${want}\n---\n# t\n`);
    });
  }

  test('capitalized Completed on a dated plan is normalized then archived', () => {
    plan('260925-1455-feature', 'Completed');
    run(['--apply']);
    assert.match(read('plans/archive/2609/260925-1455-feature/plan.md'), /status: completed/);
  });

  test('valid statuses are left alone', () => {
    for (const s of ['pending', 'in-progress', 'completed', 'cancelled', '"completed"']) {
      plan(`legacy-${s.replace(/\W/g, '')}`, s);
    }
    const r = run([]);
    assert.doesNotMatch(r.out, /normalize-status/);
  });

  test('unknown or missing status is reported and never rewritten', () => {
    const wip = plan('legacy-wip', 'wip');
    const bare = write('plans/legacy-bare/plan.md', '# no frontmatter\n');
    const r = run(['--apply']);
    assert.match(r.out, /! unknown-status \(2\)/);
    assert.ok(r.out.includes('wip'));
    assert.equal(fs.readFileSync(wip, 'utf8'), '---\ntitle: t\nstatus: wip\n---\n# t\n');
    assert.equal(fs.readFileSync(bare, 'utf8'), '# no frontmatter\n');
  });

  test('only the frontmatter status line is touched (body text and CRLF preserved)', () => {
    const file = write(
      'plans/legacy-crlf/plan.md',
      '---\r\nstatus: done\r\ntitle: t\r\n---\r\nstatus: done\r\n'
    );
    run(['--apply']);
    assert.equal(fs.readFileSync(file, 'utf8'), '---\r\nstatus: completed\r\ntitle: t\r\n---\r\nstatus: done\r\n');
  });
});

describe('archive finished plans', () => {
  test('completed plan moves to archive/YYMM with its reports; scratch removed', () => {
    plan('260925-1455-feature', 'completed');
    write('plans/260925-1455-feature/phase-01-x.md', 'phase');
    write('plans/260925-1455-feature/reports/r.md', 'report');
    write('plans/260925-1455-feature/scratch/tmp.py', 'print(1)');
    write(`plans/260925-1455-feature/scratch/${PYC_DIR}/a.pyc`);

    const before = snapshot(tmp);
    const dry = run([]);
    assert.equal(dry.code, 0, dry.err);
    assert.match(dry.out, /archive \(1\)/);
    // scratch/ is removed as part of the archive action; junk inside it is not counted separately
    assert.doesNotMatch(dry.out, /^remove \(/m);
    assert.match(dry.out, /scratch\/ removed/);
    assert.match(dry.out, /dry-run: 1 actions/);
    assert.deepEqual(snapshot(tmp), before);

    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    const dest = 'plans/archive/2609/260925-1455-feature';
    assert.equal(read(`${dest}/reports/r.md`), 'report');
    assert.equal(read(`${dest}/phase-01-x.md`), 'phase');
    assert.ok(!exists(`${dest}/scratch`));
    assert.ok(!exists('plans/260925-1455-feature'));
  });

  test('cancelled is archived; pending and in-progress stay', () => {
    plan('260101-0900-old', 'cancelled');
    plan('260925-1455-live', 'in-progress');
    plan('260926-1000-next', 'pending');
    run(['--apply']);
    assert.ok(exists('plans/archive/2601/260101-0900-old/plan.md'));
    assert.ok(exists('plans/260925-1455-live/plan.md'));
    assert.ok(exists('plans/260926-1000-next/plan.md'));
  });

  test('implemented status is normalized then archived in one run', () => {
    plan('260925-1455-feature', 'implemented');
    const dry = run([]);
    assert.match(dry.out, /normalize-status \(1\)/);
    assert.match(dry.out, /archive \(1\)/);
    run(['--apply']);
    assert.match(read('plans/archive/2609/260925-1455-feature/plan.md'), /status: completed/);
  });

  test('existing archive target is never overwritten', () => {
    plan('260925-1455-feature', 'completed');
    write('plans/archive/2609/260925-1455-feature/plan.md', 'older archived copy');
    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /! skipped \(1\)/);
    assert.equal(read('plans/archive/2609/260925-1455-feature/plan.md'), 'older archived copy');
    assert.ok(exists('plans/260925-1455-feature/plan.md'));
  });

  test('completed plan without a date prefix is reported, not moved', () => {
    plan('legacy-plan', 'completed');
    const r = run(['--apply']);
    assert.match(r.out, /! skipped \(1\)/);
    assert.match(r.out, /no date prefix/);
    assert.ok(exists('plans/legacy-plan/plan.md'));
  });
});

describe('bucket loose reports', () => {
  test('moves plans/reports/*.md into reports/YYMM by filename date', () => {
    write('plans/reports/researcher-260814-0902-x.md', 'a');
    write('plans/reports/planner-260929-1709-y.md', 'b');
    write('plans/reports/2608/already-bucketed.md', 'c');
    const before = snapshot(tmp);
    const dry = run([]);
    assert.equal(dry.code, 0, dry.err);
    assert.match(dry.out, /bucket \(2\)/);
    assert.match(dry.out, /dry-run: 2 actions/);
    assert.deepEqual(snapshot(tmp), before);

    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.equal(read('plans/reports/2608/researcher-260814-0902-x.md'), 'a');
    assert.equal(read('plans/reports/2609/planner-260929-1709-y.md'), 'b');
    assert.equal(read('plans/reports/2608/already-bucketed.md'), 'c');
    assert.ok(!exists('plans/reports/researcher-260814-0902-x.md'));
  });

  test('undated report and dotfiles stay; undated one is reported', () => {
    write('plans/reports/notes.md');
    write('plans/reports/.gitkeep', '');
    const r = run(['--apply']);
    assert.match(r.out, /! skipped \(1\)/);
    assert.match(r.out, /notes\.md: no date/);
    assert.ok(exists('plans/reports/notes.md'));
    assert.ok(exists('plans/reports/.gitkeep'));
  });

  test('never overwrites an existing bucketed file', () => {
    write('plans/reports/researcher-260814-0902-x.md', 'loose');
    write('plans/reports/2608/researcher-260814-0902-x.md', 'bucketed');
    const r = run(['--apply']);
    assert.match(r.out, /! skipped \(1\)/);
    assert.equal(read('plans/reports/2608/researcher-260814-0902-x.md'), 'bucketed');
    assert.equal(read('plans/reports/researcher-260814-0902-x.md'), 'loose');
  });
});

describe('flag non-plan dirs', () => {
  test('dir without plan.md is reported, reserved dirs are not, nothing moves', () => {
    write('plans/random-dir/notes.md');
    for (const d of ['reports', 'archive', 'templates', 'visuals']) write(`plans/${d}/keep.txt`);
    const before = snapshot(tmp);
    const r = run(['--apply']);
    assert.match(r.out, /! not-a-plan \(1\)/);
    assert.match(r.out, /plans\/random-dir/);
    assert.deepEqual(snapshot(tmp), before);
  });
});

describe('merge linked-worktree plans', () => {
  const gitEnv = { ...process.env };
  for (const k of Object.keys(gitEnv)) if (k.startsWith('GIT_')) delete gitEnv[k];
  const git = (cwd, ...args) =>
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, env: gitEnv, encoding: 'utf8' });

  /** Real repo at tmp with one linked worktree inside it (like .claude/worktrees/<name>). */
  function repoWithWorktree() {
    assert.equal(git(tmp, 'init', '-q').status, 0);
    assert.equal(git(tmp, 'commit', '--allow-empty', '-qm', 'init').status, 0);
    const wt = path.join(tmp, '.claude', 'worktrees', 'wt1');
    const r = git(tmp, 'worktree', 'add', '-q', wt, '-b', 'wt1');
    assert.equal(r.status, 0, r.stderr);
    return wt;
  }
  /** Another linked worktree next to wt1. */
  function addWorktree(name) {
    const wt = path.join(tmp, '.claude', 'worktrees', name);
    const r = git(tmp, 'worktree', 'add', '-q', wt, '-b', name);
    assert.equal(r.status, 0, r.stderr);
    return wt;
  }
  const inWt = (wt, rel, content = 'x') => {
    const p = path.join(wt, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
  };

  test('copies missing files, skips identical, lists conflicts, never touches worktree copies', () => {
    const wt = repoWithWorktree();
    plan('260925-1455-a', 'pending');
    write('plans/260925-1455-a/same.md', 'same');
    write('plans/260925-1455-a/diff.md', 'main');
    inWt(wt, 'plans/260925-1455-a/same.md', 'same');
    inWt(wt, 'plans/260925-1455-a/diff.md', 'worktree');
    inWt(wt, 'plans/260925-1455-a/new.md', 'new');
    inWt(wt, 'plans/260926-1000-b/plan.md', '---\nstatus: pending\n---\n');
    inWt(wt, 'plans/260926-1000-b/reports/r.md', 'r');
    inWt(wt, `plans/260925-1455-a/${PYC_DIR}/c.pyc`);
    inWt(wt, 'plans/.DS_Store');

    const wtBefore = snapshot(path.join(wt, 'plans'));
    const before = snapshot(path.join(tmp, 'plans'));
    const dry = run([]);
    assert.equal(dry.code, 0, dry.err);
    assert.match(dry.out, /merge \(3\)/);
    assert.match(dry.out, /! conflict \(1\)/);
    assert.match(dry.out, /diff\.md/);
    assert.doesNotMatch(dry.out, /same\.md/);
    assert.deepEqual(snapshot(path.join(tmp, 'plans')), before);

    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.equal(read('plans/260925-1455-a/new.md'), 'new');
    assert.equal(read('plans/260926-1000-b/reports/r.md'), 'r');
    assert.equal(read('plans/260925-1455-a/diff.md'), 'main');
    assert.ok(!exists(`plans/260925-1455-a/${PYC_DIR}`));
    assert.ok(!exists('plans/.DS_Store'));
    assert.deepEqual(snapshot(path.join(wt, 'plans')), wtBefore);
  });

  test('worktree plans symlinked to main plans are skipped', () => {
    const wt = repoWithWorktree();
    plan('260925-1455-a', 'pending');
    fs.symlinkSync(path.join(tmp, 'plans'), path.join(wt, 'plans'));
    const r = run([]);
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.out, /merge|conflict/);
  });

  test('root defaults to the main worktree when run from a linked worktree', () => {
    const wt = repoWithWorktree();
    write('plans/reports/researcher-260814-0902-x.md', 'a');
    inWt(wt, 'plans/260926-1000-b/plan.md', '---\nstatus: pending\n---\n');
    const r = run(['--apply'], { cwd: wt, root: false });
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('plans/reports/2608/researcher-260814-0902-x.md'));
    assert.ok(exists('plans/260926-1000-b/plan.md'));
  });

  test('a plan already archived in main is not resurrected; only differing or missing files are reported', () => {
    const wt = repoWithWorktree();
    write('plans/archive/2609/260925-1455-a/plan.md', 'archived');
    write('plans/archive/2609/260925-1455-a/reports/r.md', 'report');
    inWt(wt, 'plans/260925-1455-a/plan.md', 'older worktree edit'); // differs from the archived copy
    inWt(wt, 'plans/260925-1455-a/reports/r.md', 'report'); // identical: silent
    inWt(wt, 'plans/260925-1455-a/extra.md', 'e'); // archived copy has no such file
    inWt(wt, 'plans/260925-1455-a/scratch/t.py', 'x'); // scratch is dropped on archive: silent
    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /! conflict \(1\)/);
    assert.match(r.out, /260925-1455-a\/plan\.md differs from archived copy/);
    assert.match(r.out, /! skipped \(1\)/);
    assert.match(r.out, /260925-1455-a\/extra\.md: plan already archived in main/);
    assert.doesNotMatch(r.out, /r\.md|scratch/);
    assert.ok(!exists('plans/260925-1455-a'));
  });

  test('worktree files identical to the archived copy produce no output at all', () => {
    const wt = repoWithWorktree();
    write('plans/archive/2609/260925-1455-a/plan.md', 'archived');
    inWt(wt, 'plans/260925-1455-a/plan.md', 'archived');
    const r = run([]);
    assert.equal(r.out.trim(), 'dry-run: 0 actions');
  });

  test('flat worktree report already bucketed in main: identical is silent, different is a conflict', () => {
    const wt = repoWithWorktree();
    write('plans/reports/2608/researcher-260814-0902-x.md', 'same');
    write('plans/reports/2608/researcher-260814-0903-y.md', 'main version');
    inWt(wt, 'plans/reports/researcher-260814-0902-x.md', 'same');
    inWt(wt, 'plans/reports/researcher-260814-0903-y.md', 'worktree version');
    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /! conflict \(1\)/);
    assert.match(r.out, /researcher-260814-0903-y\.md differs from plans\/reports\/2608\/researcher-260814-0903-y\.md/);
    assert.doesNotMatch(r.out, /merge|researcher-260814-0902-x/);
    assert.ok(!exists('plans/reports/researcher-260814-0902-x.md'));
    assert.ok(!exists('plans/reports/researcher-260814-0903-y.md'));
    assert.equal(read('plans/reports/2608/researcher-260814-0903-y.md'), 'main version');
  });

  test('re-running is a no-op even when the worktree copy keeps a status main normalized (done, In-Progress)', () => {
    const wt = repoWithWorktree();
    // main has neither plan; the worktree holds stale copies whose status text main will rewrite
    inWt(wt, 'plans/260925-1455-old/plan.md', '---\ntitle: t\nstatus: done\n---\n# t\n');
    inWt(wt, 'plans/260925-1455-old/phase-01.md', 'p1');
    inWt(wt, 'plans/260930-1000-live/plan.md', '---\ntitle: t\nstatus: In-Progress\n---\n# t\n');
    inWt(wt, 'plans/260930-1000-live/phase-01.md', 'p1');

    const first = run(['--apply']);
    assert.equal(first.code, 0, first.err);
    assert.match(read('plans/archive/2609/260925-1455-old/plan.md'), /status: completed/);
    assert.match(read('plans/260930-1000-live/plan.md'), /status: in-progress/);

    const second = run([]);
    assert.equal(second.out.trim(), 'dry-run: 0 actions');
    assert.equal(run(['--apply']).out.trim(), 'applied 0 actions');
  });

  test('a genuinely different plan.md is still a conflict (only the status text is normalized away)', () => {
    const wt = repoWithWorktree();
    write('plans/260930-1000-live/plan.md', '---\nstatus: in-progress\n---\nmain body\n');
    inWt(wt, 'plans/260930-1000-live/plan.md', '---\nstatus: In-Progress\n---\nworktree body\n');
    const r = run([]);
    assert.match(r.out, /! conflict \(1\)/);
  });

  test('one worktree holding flat and bucketed copies of a report merges it once (no flat duplicate)', () => {
    const wt = repoWithWorktree();
    inWt(wt, 'plans/reports/researcher-260814-0902-x.md', 'same');
    inWt(wt, 'plans/reports/2608/researcher-260814-0902-x.md', 'same');
    const dry = run([]);
    assert.match(dry.out, /merge \(1\)/);
    assert.doesNotMatch(dry.out, /conflict/);
    run(['--apply']);
    assert.equal(read('plans/reports/2608/researcher-260814-0902-x.md'), 'same');
    assert.ok(!exists('plans/reports/researcher-260814-0902-x.md'));
    assert.equal(run([]).out.trim(), 'dry-run: 0 actions');
  });

  test('flat vs bucketed copies in two worktrees: merged once, a difference names the other worktree file', () => {
    const wt1 = repoWithWorktree();
    const wt2 = addWorktree('wt2');
    inWt(wt1, 'plans/reports/researcher-260814-0902-x.md', 'one');
    inWt(wt2, 'plans/reports/2608/researcher-260814-0902-x.md', 'two');
    inWt(wt1, 'plans/reports/researcher-260814-0903-y.md', 'same');
    inWt(wt2, 'plans/reports/2608/researcher-260814-0903-y.md', 'same');
    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /merge \(2\)/);
    assert.match(r.out, /! conflict \(1\)/);
    // the conflict names the other worktree's file, not a main path that does not exist yet
    assert.match(r.out, /wt2\/plans\/reports\/2608\/researcher-260814-0902-x\.md differs from \S*wt1\/plans\/reports\/researcher-260814-0902-x\.md/);
    assert.equal(fs.readdirSync(path.join(tmp, 'plans/reports')).filter((n) => n.endsWith('.md')).length, 0);
    assert.ok(exists('plans/reports/2608/researcher-260814-0903-y.md'));
  });

  test('bucketed worktree report whose flat twin still sits in main is recognised', () => {
    const wt = repoWithWorktree();
    write('plans/reports/researcher-260814-0902-x.md', 'same');
    inWt(wt, 'plans/reports/2608/researcher-260814-0902-x.md', 'same');
    const r = run([]);
    assert.doesNotMatch(r.out, /merge|conflict/);
    assert.match(r.out, /dry-run: 1 actions/); // only main's own bucketing of its flat copy
  });

  test('same plan in a legacy flat archive and a month dir: silent if any archived copy matches', () => {
    const wt = repoWithWorktree();
    write('plans/archive/2609/260925-1455-a/plan.md', 'M1');
    write('plans/archive/2609/260925-1455-a/notes.md', 'M2');
    write('plans/archive/260925-1455-a/plan.md', 'F1');
    write('plans/archive/260925-1455-a/notes.md', 'F2');
    inWt(wt, 'plans/260925-1455-a/plan.md', 'M1'); // matches the month copy only
    inWt(wt, 'plans/260925-1455-a/notes.md', 'F2'); // matches the flat copy only
    assert.equal(run([]).out.trim(), 'dry-run: 0 actions');
  });

  test('re-running --apply is a no-op: nothing to merge, nothing to flag', () => {
    const wt = repoWithWorktree();
    const done = '---\nstatus: completed\n---\n';
    // main: a flat report and a finished plan; the worktree keeps an older copy of both plus one more report
    write('plans/reports/researcher-260814-0902-x.md', 'a');
    write('plans/260925-1455-done/plan.md', done);
    write('plans/260925-1455-done/reports/r.md', 'r');
    write('plans/260925-1455-done/scratch/tmp.py', 'x');
    inWt(wt, 'plans/reports/researcher-260814-0902-x.md', 'a');
    inWt(wt, 'plans/reports/planner-260929-1200-y.md', 'b');
    inWt(wt, 'plans/260925-1455-done/plan.md', done);
    inWt(wt, 'plans/260925-1455-done/reports/r.md', 'r');
    inWt(wt, 'plans/260925-1455-done/scratch/tmp.py', 'x');

    const first = run(['--apply']);
    assert.equal(first.code, 0, first.err);
    assert.match(first.out, /applied 4 actions/); // merge y, archive plan, bucket x and y
    assert.equal(read('plans/reports/2608/researcher-260814-0902-x.md'), 'a');
    assert.equal(read('plans/reports/2609/planner-260929-1200-y.md'), 'b');
    assert.ok(exists('plans/archive/2609/260925-1455-done/plan.md'));

    const second = run([]);
    assert.equal(second.code, 0, second.err);
    assert.equal(second.out.trim(), 'dry-run: 0 actions');
    const wtBefore = snapshot(path.join(wt, 'plans'));
    const third = run(['--apply']);
    assert.equal(third.out.trim(), 'applied 0 actions');
    assert.ok(!exists('plans/reports/researcher-260814-0902-x.md')); // no flat duplicates came back
    assert.ok(!exists('plans/reports/planner-260929-1200-y.md'));
    assert.deepEqual(snapshot(path.join(wt, 'plans')), wtBefore);
  });

  test('legacy flat archive/<plan>/ does not make reports/ (or other children) look archived', () => {
    const wt = repoWithWorktree();
    write('plans/archive/legacy-plan-a/plan.md', 'archived');
    write('plans/archive/legacy-plan-a/reports/r.md', 'old report');
    inWt(wt, 'plans/reports/researcher-260929-1200-x.md', 'worktree report');
    inWt(wt, 'plans/legacy-plan-a/plan.md', 'archived'); // identical to the flat archived copy

    const dry = run([]);
    assert.equal(dry.code, 0, dry.err);
    assert.match(dry.out, /merge \(1\)/); // the report; not treated as "archived"
    // the flat entry counts by its own name: its identical copy is silently recognised, not merged
    assert.doesNotMatch(dry.out, /legacy-plan-a|already archived/);

    run(['--apply']);
    assert.equal(read('plans/reports/2609/researcher-260929-1200-x.md'), 'worktree report'); // merged, then bucketed
    assert.ok(!exists('plans/legacy-plan-a'));
  });

  test('the archived check never applies to reserved dir names', () => {
    const wt = repoWithWorktree();
    write('plans/archive/reports/plan.md', 'odd legacy entry named like a reserved dir');
    inWt(wt, 'plans/reports/researcher-260929-1200-x.md', 'worktree report');
    const dry = run([]);
    assert.match(dry.out, /merge \(1\)/);
    assert.doesNotMatch(dry.out, /already archived/);
  });

  test('main without plans/ still receives worktree plans, which flow through later steps on --apply', () => {
    const wt = repoWithWorktree();
    inWt(wt, 'plans/260926-1000-b/plan.md', '---\nstatus: done\n---\n');
    run(['--apply']);
    assert.match(read('plans/archive/2609/260926-1000-b/plan.md'), /status: completed/);
  });

  test('outside git the root defaults to cwd', () => {
    plan('260925-1455-a', 'completed');
    const r = run(['--apply'], { root: false });
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('plans/archive/2609/260925-1455-a/plan.md'));
  });

  test('bare repo + worktrees: root is the cwd worktree, never the bare git dir', () => {
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src);
    assert.equal(git(src, 'init', '-q').status, 0);
    assert.equal(git(src, 'commit', '--allow-empty', '-qm', 'init').status, 0);
    const bare = path.join(tmp, 'bare-repo.git');
    assert.equal(git(tmp, 'clone', '-q', '--bare', src, bare).status, 0);
    const a = path.join(tmp, 'wt-a');
    const b = path.join(tmp, 'wt-b');
    for (const [dir, br] of [[a, 'a'], [b, 'b']]) {
      const r = git(bare, 'worktree', 'add', '-q', dir, '-b', br);
      assert.equal(r.status, 0, r.stderr);
    }
    inWt(b, 'plans/260929-1200-b-only/plan.md', '---\nstatus: pending\n---\n');
    // a stray plans/ inside the bare git dir (left by an older run) is not a worktree to merge from
    inWt(bare, 'plans/260929-1300-stray/plan.md', '---\nstatus: pending\n---\n');

    const dry = run([], { cwd: a, root: false });
    assert.equal(dry.code, 0, dry.err);
    assert.doesNotMatch(dry.out + dry.err, /bare-repo/);
    assert.match(dry.out, /merge \(1\)/);

    const r = run(['--apply'], { cwd: a, root: false });
    assert.equal(r.code, 0, r.err);
    assert.ok(fs.existsSync(path.join(a, 'plans/260929-1200-b-only/plan.md')));
    assert.ok(!fs.existsSync(path.join(a, 'plans/260929-1300-stray')));
  });

  test('run from a repo subdirectory: plans live under cwd, merged from the same subdir of other worktrees', () => {
    const wt = repoWithWorktree();
    fs.mkdirSync(path.join(tmp, 'pkg'));
    inWt(wt, 'pkg/plans/260929-1200-p/plan.md', '---\nstatus: pending\n---\n');
    const r = run(['--apply'], { cwd: path.join(tmp, 'pkg'), root: false });
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('pkg/plans/260929-1200-p/plan.md'));
  });
});

describe('--plans guard', () => {
  test('rejects a plans dir equal to the root or outside it', () => {
    plan('260925-1455-a', 'pending');
    for (const bad of ['.', '..', path.dirname(tmp)]) {
      const r = run(['--plans', bad]);
      assert.equal(r.code, 1, `--plans ${bad}`);
      assert.match(r.err, /inside the root/);
    }
  });

  test('accepts a nested plans dir', () => {
    write('docs/plans/260925-1455-a/plan.md', '---\nstatus: completed\n---\n');
    const r = run(['--plans', 'docs/plans', '--apply']);
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('docs/plans/archive/2609/260925-1455-a/plan.md'));
  });
});

describe('plans dir from project config', () => {
  const config = (plansPath) =>
    write('.claude/config/adf-config.json', JSON.stringify({ paths: { plans: plansPath } }));
  const done = '---\nstatus: completed\n---\n';

  test('paths.plans is the default plans dir for a full run', () => {
    config('work/plans');
    write('work/plans/260925-1455-a/plan.md', done);
    write('plans/260925-1455-untouched/plan.md', done); // the stock location is ignored when configured
    const r = run(['--apply']);
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('work/plans/archive/2609/260925-1455-a/plan.md'));
    assert.ok(exists('plans/260925-1455-untouched/plan.md'));
  });

  test('--plans still overrides the configured path', () => {
    config('work/plans');
    write('plans/260925-1455-b/plan.md', done);
    const r = run(['--plans', 'plans', '--apply']);
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('plans/archive/2609/260925-1455-b/plan.md'));
  });

  test('archive <plan-dir> honours the configured plans dir', () => {
    config('work/plans');
    write('work/plans/260925-1455-x/plan.md', done);
    const r = run(['archive', 'work/plans/260925-1455-x', '--apply']);
    assert.equal(r.code, 0, r.err);
    assert.ok(exists('work/plans/archive/2609/260925-1455-x/plan.md'));
  });

  test('a configured plans dir outside the root is rejected', () => {
    config(path.dirname(tmp));
    plan('260925-1455-a', 'completed');
    const r = run([]);
    assert.equal(r.code, 1);
    assert.match(r.err, /inside the root/);
  });
});

describe('archive subcommand', () => {
  test('dry-run lists, --apply moves one plan (plus reports) and removes scratch', () => {
    plan('260925-1455-x', 'completed');
    write('plans/260925-1455-x/reports/r.md', 'r');
    write('plans/260925-1455-x/scratch/t.py');
    plan('260926-1000-other', 'completed');

    const before = snapshot(tmp);
    const dry = run(['archive', 'plans/260925-1455-x']);
    assert.equal(dry.code, 0, dry.err);
    assert.match(dry.out, /archive \(1\)/);
    assert.match(dry.out, /dry-run: 1 actions, re-run with --apply/);
    assert.deepEqual(snapshot(tmp), before);

    const r = run(['archive', 'plans/260925-1455-x/', '--apply']); // trailing slash ok
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /applied 1 actions/);
    assert.equal(read('plans/archive/2609/260925-1455-x/reports/r.md'), 'r');
    assert.ok(!exists('plans/archive/2609/260925-1455-x/scratch'));
    assert.ok(!exists('plans/260925-1455-x'));
    assert.ok(exists('plans/260926-1000-other/plan.md')); // siblings untouched
  });

  test('archives regardless of status but warns when not completed/cancelled', () => {
    const file = plan('260925-1455-x', 'in-progress');
    const r = run(['archive', path.join(tmp, 'plans/260925-1455-x'), '--apply']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out + r.err, /warning: .*in-progress/);
    assert.ok(exists('plans/archive/2609/260925-1455-x/plan.md'));
    assert.ok(!fs.existsSync(file));
  });

  test('no warning for done/implemented (normalized to completed); status text is not rewritten', () => {
    plan('260925-1455-x', 'done');
    const r = run(['archive', 'plans/260925-1455-x', '--apply'], { root: false });
    assert.doesNotMatch(r.out + r.err, /warning/);
    assert.match(read('plans/archive/2609/260925-1455-x/plan.md'), /status: done/);
  });

  test('errors: missing arg, missing dir, no plan.md, already archived', () => {
    assert.equal(run(['archive']).code, 1);
    assert.equal(run(['archive', 'plans/nope']).code, 1);
    write('plans/260925-1455-noplan/notes.md');
    const noPlan = run(['archive', 'plans/260925-1455-noplan']);
    assert.equal(noPlan.code, 1);
    assert.match(noPlan.err, /plan\.md/);
    write('plans/archive/2609/260925-1455-x/plan.md', '---\nstatus: completed\n---\n');
    const again = run(['archive', 'plans/archive/2609/260925-1455-x']);
    assert.equal(again.code, 1);
    assert.match(again.err, /already archived/);
  });

  test('plan dir must sit directly in the plans root (no nested archive trees)', () => {
    write('elsewhere/260925-1455-x/plan.md', '---\nstatus: completed\n---\n');
    write('plans/260925-1455-outer/plan.md', '---\nstatus: completed\n---\n');
    write('plans/260925-1455-outer/nested/plan.md', '---\nstatus: completed\n---\n');
    for (const bad of ['elsewhere/260925-1455-x', 'plans/260925-1455-outer/nested']) {
      const before = snapshot(tmp);
      const r = run(['archive', bad, '--apply']);
      assert.equal(r.code, 1, bad);
      assert.match(r.err, /plans root/);
      assert.deepEqual(snapshot(tmp), before);
    }
  });

  test('exits 1 and never overwrites when the archive target exists', () => {
    plan('260925-1455-x', 'completed');
    write('plans/archive/2609/260925-1455-x/plan.md', 'older');
    const r = run(['archive', 'plans/260925-1455-x', '--apply']);
    assert.equal(r.code, 1);
    assert.match(r.out, /! skipped/);
    assert.equal(read('plans/archive/2609/260925-1455-x/plan.md'), 'older');
    assert.ok(exists('plans/260925-1455-x/plan.md'));
  });
});

describe('moveNew safety (in-process)', () => {
  const { main, moveNew } = require(SCRIPT);
  afterEach(() => mock.restoreAll());
  const exdev = () => Object.assign(new Error('cross-device'), { code: 'EXDEV' });

  test('falls back to copy + remove on EXDEV', () => {
    write('a/src/nested/f.md', 'data');
    mock.method(fs, 'renameSync', () => { throw exdev(); });
    moveNew(path.join(tmp, 'a/src'), path.join(tmp, 'b/dest'));
    assert.equal(read('b/dest/nested/f.md'), 'data');
    assert.ok(!exists('a/src'));
  });

  test('rethrows other rename errors and keeps the source', () => {
    write('a/f.md', 'data');
    mock.method(fs, 'renameSync', () => { throw Object.assign(new Error('nope'), { code: 'EACCES' }); });
    assert.throws(() => moveNew(path.join(tmp, 'a/f.md'), path.join(tmp, 'b/f.md')), /nope/);
    assert.equal(read('a/f.md'), 'data');
  });

  test('refuses to overwrite an existing destination', () => {
    write('a/f.md', 'new');
    write('b/f.md', 'old');
    assert.throws(() => moveNew(path.join(tmp, 'a/f.md'), path.join(tmp, 'b/f.md')), /refusing to overwrite/);
    assert.equal(read('b/f.md'), 'old');
    assert.equal(read('a/f.md'), 'new');
  });

  test('a failed archive move never deletes scratch (source kept, destination untouched)', () => {
    plan('260925-1455-a', 'completed');
    write('plans/260925-1455-a/scratch/mine.py', 'src scratch');
    const dest = path.join(tmp, 'plans/archive/2609/260925-1455-a');
    mock.method(fs, 'renameSync', () => {
      // another process created the archive copy after planning; our move must not touch its scratch
      fs.mkdirSync(path.join(dest, 'scratch'), { recursive: true });
      fs.writeFileSync(path.join(dest, 'scratch', 'theirs.py'), 'existing archive scratch');
      throw Object.assign(new Error('gone'), { code: 'EEXIST' });
    });
    mock.method(console, 'log', () => {});
    assert.equal(main(['--apply', '--root', tmp, '--plans', 'plans'], tmp), 1);
    assert.equal(read('plans/archive/2609/260925-1455-a/scratch/theirs.py'), 'existing archive scratch');
    assert.equal(read('plans/260925-1455-a/scratch/mine.py'), 'src scratch');
  });

  test('EXDEV copy fallback keeps relative symlinks relative', () => {
    write('a/src/target.md', 'data');
    fs.symlinkSync('target.md', path.join(tmp, 'a/src/link.md'));
    mock.method(fs, 'renameSync', () => { throw exdev(); });
    moveNew(path.join(tmp, 'a/src'), path.join(tmp, 'b/dest'));
    assert.equal(fs.readlinkSync(path.join(tmp, 'b/dest/link.md')), 'target.md');
  });

  test('a failing action is reported and makes the run exit 1', () => {
    plan('260925-1455-a', 'completed');
    mock.method(fs, 'renameSync', () => { throw Object.assign(new Error('disk on fire'), { code: 'EIO' }); });
    const lines = [];
    mock.method(console, 'log', (l) => lines.push(l));
    assert.equal(main(['--apply', '--root', tmp, '--plans', 'plans'], tmp), 1);
    assert.ok(lines.some((l) => /FAILED: disk on fire/.test(l)));
    assert.ok(lines.some((l) => /applied 0 actions, 1 failed/.test(l)));
    assert.ok(exists('plans/260925-1455-a/plan.md'));
  });
});
