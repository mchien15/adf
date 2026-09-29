#!/usr/bin/env node
/**
 * Tidy a project's plans/ directory.
 *
 * Usage:
 *   node .claude/scripts/tidy-plans.cjs [--apply] [--root <repo>] [--plans <dir>]
 *   node .claude/scripts/tidy-plans.cjs archive <plan-dir> [--apply]
 *
 * Dry-run by default: prints every planned action grouped by kind and changes nothing.
 * --apply performs them. Never overwrites an existing file; only deletes junk
 * (__pycache__/, *.pyc, .DS_Store anywhere under plans, scratch/ of an archived plan).
 *
 * --root  defaults to the hooks' base dir (resolvePlansBaseDir): from a linked worktree the main
 *         worktree, otherwise cwd (so a bare repo's git dir never becomes the root).
 * --plans defaults to the project config's paths.plans (else `plans`); a relative value is
 *         resolved against <root>. Either way it must be a directory inside <root>.
 * Plans of the other linked worktrees (`git worktree list`, bare entries skipped) are merged in.
 * archive <plan-dir> needs a plan dir that sits directly in that plans dir.
 *
 * Steps run in order (merge worktrees, normalize status, archive, bucket reports, flag non-plans,
 * junk). Dry-run reads the tree as it is now, so a plan a merge would bring in is only
 * normalized/archived once --apply runs the steps in sequence.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolvePlansBaseDir, loadConfig, RESERVED_PLAN_DIRS } = require('../hooks/lib/ck-config-utils.cjs');

/** Action kinds mutate the tree; note kinds are reported for a human to decide. */
const ACTION_KINDS = ['merge', 'normalize-status', 'archive', 'bucket', 'remove'];
const NOTE_KINDS = ['conflict', 'unknown-status', 'skipped', 'not-a-plan'];

const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];
const STATUS_SYNONYMS = new Set(['done', 'complete', 'implemented']);
const ARCHIVABLE = new Set(['completed', 'cancelled']);

const exists = (p) => {
  try { fs.lstatSync(p); return true; } catch { return false; }
};
const isJunkName = (n) => n === '__pycache__' || n === '.DS_Store' || n.endsWith('.pyc');

/** Move src to dest, refusing to overwrite; falls back to copy + remove across devices. */
function moveNew(src, dest) {
  if (exists(dest)) throw new Error(`refusing to overwrite ${dest}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    // verbatimSymlinks: keep relative links relative, or they would point into the removed source
    fs.cpSync(src, dest, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true });
    fs.rmSync(src, { recursive: true });
  }
}

/**
 * Walk a tree without following symlinks. Junk dirs are listed whole (not descended).
 * @param {string} dir
 * @param {Set<string>} skip absolute dirs to leave alone
 * @returns {{files: string[], junk: string[]}}
 */
function listTree(dir, skip = new Set()) {
  const res = { files: [], junk: [] };
  if (!exists(dir)) return res;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (isJunkName(e.name)) res.junk.push(p);
      else if (e.isDirectory() && !skip.has(p)) walk(p);
      else if (e.isFile()) res.files.push(p);
    }
  })(dir);
  return res;
}

function copyNew(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
}

/**
 * Byte-identical, or (for a plan.md) identical once both frontmatter statuses are normalized, so a
 * worktree's stale `status: done` does not clash with the `completed` this tool wrote into main.
 */
function sameContent(a, b, planMd = false) {
  try {
    const x = fs.readFileSync(a);
    const y = fs.readFileSync(b);
    if (x.equals(y)) return true;
    return planMd && withCanonicalStatus(x.toString('utf8')) === withCanonicalStatus(y.toString('utf8'));
  } catch {
    return false;
  }
}

/**
 * Plan dirs already archived, as Map<name, archived dirs[]> (a plan may sit both in a month dir and
 * in a legacy flat entry): children of the archive/YYMM month dirs, plus legacy flat entries
 * archive/<plan>/ (counted by their own name, only when they hold a plan.md, so their children
 * such as reports/ never count as archived plans).
 */
function archivedPlans(plans) {
  const root = path.join(plans, 'archive');
  const found = new Map();
  const add = (name, dir) => found.set(name, [...(found.get(name) || []), dir]);
  if (!exists(root)) return found;
  for (const b of fs.readdirSync(root, { withFileTypes: true })) {
    if (!b.isDirectory()) continue;
    const dir = path.join(root, b.name);
    if (/^\d{4}$/.test(b.name)) fs.readdirSync(dir).forEach((n) => add(n, path.join(dir, n)));
    else if (exists(path.join(dir, 'plan.md'))) add(b.name, dir);
  }
  return found;
}

/**
 * Where main may already hold worktree file `sub` (relative to plans/), and its final location.
 * A dated report lives flat (reports/<name>) until the bucket step files it under
 * reports/YYMM/<name>, so both spellings are the same file; `final` is the bucketed one.
 */
function locate(plans, sub) {
  const dest = path.join(plans, sub);
  const parts = sub.split(path.sep);
  if (parts[0] === 'reports') {
    if (parts.length === 2 && reportBucket(parts[1])) {
      const bucketed = path.join(plans, 'reports', reportBucket(parts[1]), parts[1]);
      return { dest, final: bucketed, paths: [dest, bucketed] };
    }
    if (parts.length === 3 && reportBucket(parts[2]) === parts[1]) {
      return { dest, final: dest, paths: [dest, path.join(plans, 'reports', parts[2])] };
    }
  }
  return { dest, final: dest, paths: [dest] };
}

/**
 * Step 1: copy files that linked worktrees hold in their own <plans> dir but main lacks.
 * Main "has" a file at its final location, so re-runs stay a no-op: a flat reports/<name> may
 * sit bucketed at reports/YYMM/<name>, and a plan's files may sit in its archived copy (except
 * scratch/, dropped on archive). Identical files are skipped silently, differing ones are
 * reported as conflicts, worktree copies stay.
 */
function stepMerge(ctx) {
  const wts = ctx.worktrees.filter(exists).map((w) => fs.realpathSync(w));
  if (!wts.length) return [];
  const rootReal = fs.realpathSync(ctx.root);
  // The worktree holding root; where plans sits inside it is mirrored in the other worktrees.
  const home = wts
    .filter((w) => rootReal === w || rootReal.startsWith(w + path.sep))
    .sort((a, b) => b.length - a.length)[0];
  if (!home) return [];
  const rel = path.relative(home, path.join(rootReal, path.relative(ctx.root, ctx.plans)));
  const items = [];
  const archived = archivedPlans(ctx.plans);
  const planned = new Map(); // final location -> worktree file already queued for copy
  for (const wt of wts) {
    if (wt === home) continue;
    const wtPlans = path.join(wt, rel);
    const st = exists(wtPlans) && fs.lstatSync(wtPlans);
    if (!st || !st.isDirectory()) continue; // absent, or a symlink (e.g. to main's plans)
    for (const src of listTree(wtPlans).files.sort()) {
      const sub = path.relative(wtPlans, src);
      const [top, ...restParts] = sub.split(path.sep);
      const planMd = restParts.length === 1 && restParts[0] === 'plan.md';
      const archivedDirs = restParts.length && !RESERVED_PLAN_DIRS.includes(top) && archived.get(top);
      if (archivedDirs) {
        if (restParts[0] === 'scratch') continue; // dropped when the plan was archived
        const copies = archivedDirs.map((d) => path.join(d, ...restParts)).filter(exists);
        if (!copies.length) {
          const msg = `${ctx.show(src)}: plan already archived in main, its archived copy has no such file`;
          items.push({ kind: 'skipped', msg });
        } else if (!copies.some((c) => sameContent(c, src, planMd))) {
          items.push({ kind: 'conflict', msg: `${ctx.show(src)} differs from archived copy ${ctx.show(copies[0])}` });
        }
        continue;
      }
      const { dest, final, paths } = locate(ctx.plans, sub);
      const inMain = paths.find(exists);
      const queued = planned.get(final);
      const other = queued || inMain;
      if (other) {
        if (!sameContent(other, src, planMd)) {
          items.push({ kind: 'conflict', msg: `${ctx.show(src)} differs from ${ctx.show(other)}` });
        }
        continue;
      }
      planned.set(final, src);
      items.push({ kind: 'merge', msg: `${ctx.show(src)} -> ${ctx.show(dest)}`, run: () => copyNew(src, dest) });
    }
  }
  return items;
}

/**
 * Parse the frontmatter `status:` of a plan.md text.
 * @returns {{raw: string, bare: string, value: string, start: number, end: number}|null} bare is
 *   the de-quoted value as written, value its lowercase form; start/end delimit the raw value in
 *   the text. null when there is no status.
 */
function parseStatus(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/d.exec(text);
  if (!fm) return null;
  const line = /^(status:[ \t]*)(.*?)[ \t]*$/m.exec(fm[1]);
  if (!line) return null;
  const start = fm.indices[1][0] + line.index + line[1].length;
  const raw = line[2];
  const bare = raw.replace(/^["']+|["']+$/g, '').trim();
  return { raw, bare, value: bare.toLowerCase(), start, end: start + raw.length };
}

/** Canonical status of a parsed status: done/complete/implemented -> completed, valid ones lowercased, else null. */
function canonicalStatus(st) {
  if (!st) return null;
  if (STATUS_SYNONYMS.has(st.value)) return 'completed';
  return VALID_STATUSES.includes(st.value) ? st.value : null;
}

/** Text with its frontmatter status rewritten to the canonical value; unchanged if unknown or already canonical. */
function withCanonicalStatus(text) {
  const st = parseStatus(text);
  const target = canonicalStatus(st);
  return target && st.bare !== target ? `${text.slice(0, st.start)}${target}${text.slice(st.end)}` : text;
}

const readStatus = (file) => parseStatus(fs.readFileSync(file, 'utf8'));

/** Top-level dirs of plans/ split into plan dirs (have plan.md) and everything else. */
function listPlanDirs(plans) {
  const res = { plans: [], others: [] };
  if (!exists(plans)) return res;
  for (const e of fs.readdirSync(plans, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || RESERVED_PLAN_DIRS.includes(e.name) || e.name.startsWith('.')) continue;
    const dir = path.join(plans, e.name);
    (exists(path.join(dir, 'plan.md')) ? res.plans : res.others).push(dir);
  }
  return res;
}

/**
 * Step 2: statuses match case-insensitively. done/complete/implemented become `completed` and
 * capitalized valid values (`Completed`) are lowercased; anything else is only reported.
 */
function stepNormalize(ctx) {
  const items = [];
  for (const dir of listPlanDirs(ctx.plans).plans) {
    const file = path.join(dir, 'plan.md');
    const st = readStatus(file);
    const target = canonicalStatus(st);
    if (!target) {
      items.push({ kind: 'unknown-status', msg: `${ctx.show(file)}: ${st ? st.raw : '(no status)'}` });
      continue;
    }
    ctx.status.set(dir, target);
    if (st.bare === target) continue; // already canonical (quotes alone are valid YAML)
    items.push({
      kind: 'normalize-status',
      msg: `${ctx.show(file)}: ${st.raw} -> ${target}`,
      run: () => fs.writeFileSync(file, withCanonicalStatus(fs.readFileSync(file, 'utf8'))),
    });
  }
  return items;
}

/**
 * Items that archive one plan dir to <plans>/archive/YYMM/<name> and drop its scratch/.
 * YYMM comes from the dir name's date prefix (260925-1455-x -> 2609). The scratch/ is removed
 * only after the move succeeded, inside the same action, so a failed move deletes nothing.
 */
function archiveItems(ctx, dir) {
  const name = path.basename(dir);
  const yymm = /^(\d{2}(?:0[1-9]|1[0-2]))\d{2}(?:-|$)/.exec(name);
  if (!yymm) return [{ kind: 'skipped', msg: `${ctx.show(dir)}: no date prefix, cannot pick archive/YYMM` }];
  const dest = path.join(ctx.plans, 'archive', yymm[1], name);
  if (exists(dest)) return [{ kind: 'skipped', msg: `${ctx.show(dir)}: ${ctx.show(dest)} already exists` }];
  const scratch = path.join(dir, 'scratch');
  const hasScratch = exists(scratch);
  if (hasScratch) ctx.skip.add(scratch); // dry-run: junk inside scratch/ goes with it, don't count it twice
  return [{
    kind: 'archive',
    msg: `${ctx.show(dir)} -> ${ctx.show(dest)}${hasScratch ? ' (scratch/ removed)' : ''}`,
    run: () => {
      moveNew(dir, dest);
      if (hasScratch) fs.rmSync(path.join(dest, 'scratch'), { recursive: true, force: true });
    },
  }];
}

/** Step 3: archive plan dirs whose (normalized) status is completed or cancelled. */
function stepArchive(ctx) {
  return listPlanDirs(ctx.plans).plans
    .filter((dir) => ARCHIVABLE.has(ctx.status.get(dir)))
    .flatMap((dir) => archiveItems(ctx, dir));
}

/** First -YYMMDD (or leading YYMMDD) in a report filename -> its YYMM, else null. */
function reportBucket(name) {
  const m = /(?:^|-)(\d{2}(?:0[1-9]|1[0-2]))(?:0[1-9]|[12]\d|3[01])(?=-|\.|_|$)/.exec(name);
  return m && m[1];
}

/** Step 4: files directly in plans/reports/ go to plans/reports/YYMM/. */
function stepBucket(ctx) {
  const dir = path.join(ctx.plans, 'reports');
  if (!exists(dir)) return [];
  const items = [];
  const loose = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') && !isJunkName(e.name));
  for (const e of loose) {
    const src = path.join(dir, e.name);
    const yymm = reportBucket(e.name);
    const dest = yymm && path.join(dir, yymm, e.name);
    if (!yymm) items.push({ kind: 'skipped', msg: `${ctx.show(src)}: no date in filename, left in place` });
    else if (exists(dest)) items.push({ kind: 'skipped', msg: `${ctx.show(src)}: ${ctx.show(dest)} already exists` });
    else items.push({ kind: 'bucket', msg: `${ctx.show(src)} -> ${ctx.show(dest)}`, run: () => moveNew(src, dest) });
  }
  return items;
}

/** Step 5: top-level dirs with no plan.md are flagged, never moved. */
function stepFlagNonPlans(ctx) {
  return listPlanDirs(ctx.plans).others.map((dir) => ({
    kind: 'not-a-plan',
    msg: `${ctx.show(dir)}/ has no plan.md`,
  }));
}

/** Step 6: junk anywhere under plans. */
function stepJunk(ctx) {
  return listTree(ctx.plans, ctx.skip).junk.sort().map((p) => ({
    kind: 'remove',
    msg: `junk ${ctx.show(p)}`,
    run: () => fs.rmSync(p, { recursive: true, force: true }),
  }));
}

const STEPS = [stepMerge, stepNormalize, stepArchive, stepBucket, stepFlagNonPlans, stepJunk];

function parseArgs(argv) {
  const o = { apply: false, root: null, plans: null, positional: [] };
  const value = (i, flag) => {
    if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--root') o.root = value(i++, a);
    else if (a === '--plans') o.plans = value(i++, a);
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else o.positional.push(a);
  }
  return o;
}

/** Checked-out worktree paths from `git worktree list --porcelain` (bare entries dropped); [] outside git. */
function gitWorktrees(cwd) {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split(/\r?\n\r?\n/)
      .map((block) => block.split(/\r?\n/))
      .filter((lines) => lines[0].startsWith('worktree ') && !lines.includes('bare'))
      .map((lines) => lines[0].slice(9));
  } catch {
    return [];
  }
}

const sameDir = (a, b) => {
  try { return fs.realpathSync(a) === fs.realpathSync(b); } catch { return false; }
};

/** Root (hooks rule unless --root), plans dir (must sit inside root) and the shared step context. */
function resolveTarget(o, cwd) {
  const root = o.root ? path.resolve(cwd, o.root) : resolvePlansBaseDir(cwd);
  const configured = o.plans || loadConfig({ includeProject: false, includeAssertions: false }).paths.plans || 'plans';
  const plans = path.resolve(root, configured);
  const rel = path.relative(root, plans);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    const src = o.plans ? '--plans' : 'paths.plans';
    throw new Error(`${src} must be a directory inside the root (${root}), got ${plans}`);
  }
  const show = (p) => {
    const r = path.relative(root, p);
    return r === '..' || r.startsWith(`..${path.sep}`) ? p : r;
  };
  return { root, plans, worktrees: gitWorktrees(root), show, skip: new Set(), status: new Map() };
}

/** Run items in order (apply) and record failures; dry-run leaves the tree untouched. */
function execute(items, apply) {
  if (!apply) return;
  for (const it of items) {
    if (!it.run) continue;
    try { it.run(); } catch (e) { it.error = e.message; }
  }
}

function printReport(items, { apply }) {
  for (const kind of [...ACTION_KINDS, ...NOTE_KINDS]) {
    const group = items.filter((i) => i.kind === kind);
    if (!group.length) continue;
    console.log(`${NOTE_KINDS.includes(kind) ? '! ' : ''}${kind} (${group.length})`);
    for (const it of group) console.log(`  ${it.msg}${it.error ? `  FAILED: ${it.error}` : ''}`);
  }
  const actions = items.filter((i) => i.run);
  const failed = actions.filter((i) => i.error).length;
  const notes = items.length - actions.length;
  const tail = `${notes ? ` (${notes} need attention)` : ''}`;
  if (apply) {
    console.log(`applied ${actions.length - failed} actions${failed ? `, ${failed} failed` : ''}${tail}`);
  } else {
    console.log(`dry-run: ${actions.length} actions${tail}${actions.length ? ', re-run with --apply' : ''}`);
  }
  return failed ? 1 : 0;
}

/** `archive <plan-dir>`: archive one plan whatever its status (warns if not completed/cancelled). */
function archiveOne(o, cwd) {
  const [, target, ...extra] = o.positional;
  if (!target || extra.length) throw new Error('usage: tidy-plans.cjs archive <plan-dir> [--apply]');
  const dir = path.resolve(cwd, target);
  const parent = path.dirname(dir);
  if (!exists(path.join(dir, 'plan.md'))) throw new Error(`not a plan dir (plan.md missing): ${dir}`);
  if (path.basename(path.dirname(parent)) === 'archive') throw new Error(`already archived: ${dir}`);
  const ctx = resolveTarget(o, cwd);
  if (!sameDir(parent, ctx.plans)) {
    throw new Error(`plan dir must sit directly in the plans root (${ctx.plans}): ${dir}`);
  }
  const st = readStatus(path.join(dir, 'plan.md'));
  const status = canonicalStatus(st);
  if (!ARCHIVABLE.has(status)) {
    console.warn(`warning: status is ${st ? st.raw : '(none)'}, not completed/cancelled; archiving anyway`);
  }
  const items = archiveItems(ctx, dir);
  execute(items, o.apply);
  const code = printReport(items, o);
  return items.some((i) => i.kind === 'skipped') ? 1 : code; // asked for this one plan: not archiving it is a failure
}

function tidy(o, cwd) {
  const ctx = resolveTarget(o, cwd);
  const { plans } = ctx;
  const items = [];
  for (const step of STEPS) {
    const got = step(ctx);
    execute(got, o.apply);
    items.push(...got);
  }
  // A missing main plans/ is fine when worktrees held plans to merge into it; otherwise wrong root/plans.
  if (!items.length && !exists(plans)) throw new Error(`plans dir not found: ${plans}`);
  return printReport(items, o);
}

function main(argv, cwd) {
  try {
    const o = parseArgs(argv);
    if (o.positional[0] === 'archive') return archiveOne(o, cwd);
    if (o.positional.length) throw new Error(`unexpected argument ${o.positional[0]}`);
    return tidy(o, cwd);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2), process.cwd()));
module.exports = { main, moveNew };
