/**
 * Test helper: throwaway git repo with a linked worktree.
 *
 * Every returned path is realpath-resolved. On macOS os.tmpdir() lives under /var,
 * a symlink to /private/var, while git reports /private/var/... — comparing an
 * unresolved temp path against git output would fail spuriously.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Run git with an argument array (no shell, so no quoting concerns)
 * @param {string} cwd - Working directory
 * @param {...string} args - git arguments
 * @returns {string} Trimmed stdout
 */
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Create a main repo with one commit.
 * @param {string} dir - Directory to create and init
 */
function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@test.com');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(dir, 'README.md'), 'test');
  git(dir, 'add', 'README.md');
  git(dir, 'commit', '-q', '-m', 'init');
}

/**
 * Create <tmp>/main (repo) and <tmp>/wt (linked worktree on a new branch).
 * @param {Object} [options]
 * @param {string} [options.branch='feat/wt-test'] - Branch checked out in the linked worktree
 * @returns {{ root: string, main: string, worktree: string, cleanup: () => void }}
 */
function createRepoWithWorktree({ branch = 'feat/wt-test' } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-plans-root-')));
  const main = path.join(root, 'main');
  const worktree = path.join(root, 'wt');
  initRepo(main);
  git(main, 'worktree', 'add', '-q', worktree, '-b', branch);
  return { root, main, worktree, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/**
 * Create a plain (non-worktree) repo.
 * @returns {{ root: string, main: string, cleanup: () => void }}
 */
function createPlainRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-plans-plain-')));
  const main = path.join(root, 'main');
  initRepo(main);
  return { root, main, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/**
 * Current month bucket (YYMM) as the hooks compute it.
 * Returns both the value before and after `fn` so a test straddling midnight of the
 * last day of a month can accept either.
 * @param {() => *} fn
 * @returns {{ result: *, buckets: string[] }}
 */
function withMonthBuckets(fn) {
  const yymm = () => {
    const d = new Date();
    return String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
  };
  const before = yymm();
  const result = fn();
  return { result, buckets: [...new Set([before, yymm()])] };
}

module.exports = { git, createRepoWithWorktree, createPlainRepo, withMonthBuckets };
