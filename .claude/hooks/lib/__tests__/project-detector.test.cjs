#!/usr/bin/env node
/**
 * project-detector.test.cjs - Comprehensive test suite for project-detector.cjs
 * Run: node --test .claude/hooks/lib/__tests__/project-detector.test.cjs
 *
 * Tests all detection functions including edge cases identified in issue #455:
 * - Git detection with isGitRepo guard
 * - Python detection with `which`/`where` optimization
 * - Edge cases: deleted CWD, symlinks, worktrees, permissions
 *
 * Hermetic: every fixture lives in a realpath'd temp dir, tests that change cwd or
 * env restore them, and real-git tests run against an isolated HOME/git config.
 * Assumes os.tmpdir() is not itself inside a git repository.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

// Module under test
const {
  // Git detection
  isGitRepo,
  getGitRemoteUrl,
  getGitBranch,
  getGitRoot,

  // Python detection
  findPythonBinary,
  getPythonVersion,
  getPythonPaths,
  isValidPythonPath,

  // Project detection
  detectProjectType,
  detectPackageManager,
  detectFramework,

  // Helpers
  execSafe,
  execFileSafe
} = require('../project-detector.cjs');

// ═══════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a temporary directory for testing
 * @returns {string} Path to temp directory
 */
function createTempDir() {
  // realpath: macOS os.tmpdir() is under /var, a symlink to /private/var, while
  // process.cwd() and `git rev-parse --show-toplevel` report the resolved path
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'project-detector-test-')));
}

/**
 * Create a mock git repository
 * @param {string} dir - Directory to initialize
 * @param {Object} options - Options for git init
 * @returns {string} Path to git repo
 */
function createMockGitRepo(dir, options = {}) {
  fs.mkdirSync(dir, { recursive: true });

  if (options.worktree) {
    // Create .git file (worktree style) instead of directory
    const gitdir = options.gitdir || path.join(path.dirname(dir), 'main', '.git', 'worktrees', 'test');
    fs.writeFileSync(path.join(dir, '.git'), `gitdir: ${gitdir}`);
  } else {
    // Create .git directory
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  }

  if (options.branch) {
    const headPath = path.join(dir, '.git', 'HEAD');
    fs.mkdirSync(path.dirname(headPath), { recursive: true });
    fs.writeFileSync(headPath, `ref: refs/heads/${options.branch}\n`);
  }

  return dir;
}

/**
 * Cleanup temp directory
 * @param {string} dir - Directory to remove
 */
function cleanupTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Set or unset env vars (undefined = unset)
 * @param {Object<string, string|undefined>} overrides
 * @returns {() => void} Function restoring the previous values
 */
function overrideEnv(overrides) {
  const saved = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

const HAS_GIT = spawnSync('git', ['--version']).status === 0;
const SKIP_NO_GIT = HAS_GIT ? false : 'git is not installed';

/**
 * Run fn with cwd inside a freshly `git init`-ed repo under tempDir. git ignores the
 * machine's real ~/.gitconfig and any GIT_* vars leaked from a parent git process
 * (e.g. when the suite runs from a git hook). cwd and env are restored afterwards.
 * @param {string} tempDir - Existing temp dir to build the repo and fake HOME in
 * @param {{branch?: string, remoteUrl?: string}} options
 * @param {(repoDir: string) => void} fn
 */
function withRealGitRepo(tempDir, { branch = 'main', remoteUrl } = {}, fn) {
  const homeDir = path.join(tempDir, 'home');
  const repoDir = path.join(tempDir, 'repo');
  fs.mkdirSync(homeDir);
  fs.mkdirSync(repoDir);

  const originalCwd = process.cwd();
  const restoreEnv = overrideEnv({
    HOME: homeDir,
    USERPROFILE: homeDir,
    XDG_CONFIG_HOME: undefined,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_INDEX_FILE: undefined
  });
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
    git('init', '-q');
    git('symbolic-ref', 'HEAD', `refs/heads/${branch}`);
    if (remoteUrl) git('remote', 'add', 'origin', remoteUrl);
    process.chdir(repoDir);
    fn(repoDir);
  } finally {
    process.chdir(originalCwd);
    restoreEnv();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GIT DETECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('isGitRepo', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('returns true for directory with .git directory', () => {
    createMockGitRepo(tempDir);
    assert.strictEqual(isGitRepo(tempDir), true);
  });

  it('returns true for directory with .git file (worktree)', () => {
    createMockGitRepo(tempDir, { worktree: true });
    assert.strictEqual(isGitRepo(tempDir), true);
  });

  it('returns false for directory without .git', () => {
    assert.strictEqual(isGitRepo(tempDir), false);
  });

  it('returns true for subdirectory of git repo', () => {
    createMockGitRepo(tempDir);
    const subDir = path.join(tempDir, 'src', 'components');
    fs.mkdirSync(subDir, { recursive: true });
    assert.strictEqual(isGitRepo(subDir), true);
  });

  it('returns false for the system temp directory (non-git directory)', () => {
    assert.strictEqual(isGitRepo(fs.realpathSync.native(os.tmpdir())), false);
  });

  it('uses process.cwd() when no argument provided', () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      createMockGitRepo(tempDir);
      // Re-check after creating .git in cwd
      assert.strictEqual(isGitRepo(), true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('handles deeply nested directories', () => {
    createMockGitRepo(tempDir);
    const deepDir = path.join(tempDir, 'a', 'b', 'c', 'd', 'e', 'f');
    fs.mkdirSync(deepDir, { recursive: true });
    assert.strictEqual(isGitRepo(deepDir), true);
  });

  it('returns false gracefully for non-existent directory', () => {
    const nonExistent = path.join(tempDir, 'does-not-exist');
    // Should not throw, should return false
    assert.strictEqual(isGitRepo(nonExistent), false);
  });

  it('handles symlinked .git directory', (t) => {
    // Create actual .git in a separate location
    const actualGitDir = path.join(tempDir, 'actual-git');
    fs.mkdirSync(path.join(actualGitDir, '.git'), { recursive: true });

    // Create symlink in test directory
    const symlinkDir = path.join(tempDir, 'symlink-repo');
    fs.mkdirSync(symlinkDir, { recursive: true });

    try {
      fs.symlinkSync(path.join(actualGitDir, '.git'), path.join(symlinkDir, '.git'));
      assert.strictEqual(isGitRepo(symlinkDir), true);
    } catch (e) {
      // Skip if symlinks not supported (Windows without admin)
      if (e.code === 'EPERM') {
        t.skip('symlinks not permitted (insufficient privileges)');
        return;
      }
      throw e;
    }
  });
});

describe('getGitBranch', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
  });

  it('returns null for non-git directory', () => {
    process.chdir(tempDir);
    assert.strictEqual(getGitBranch(), null);
  });

  it('returns null for non-git directory (no git command executed)', () => {
    process.chdir(fs.realpathSync.native(os.tmpdir()));
    // This should NOT execute git command, just return null from isGitRepo check
    const result = getGitBranch();
    assert.strictEqual(result, null);
  });

  it('returns branch name for actual git repo', { skip: SKIP_NO_GIT }, () => {
    withRealGitRepo(tempDir, { branch: 'feature/detector' }, () => {
      assert.strictEqual(getGitBranch(), 'feature/detector');
    });
  });
});

describe('getGitRoot', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
  });

  it('returns null for non-git directory', () => {
    process.chdir(tempDir);
    assert.strictEqual(getGitRoot(), null);
  });

  it('returns path for actual git repo', { skip: SKIP_NO_GIT }, () => {
    withRealGitRepo(tempDir, {}, (repoDir) => {
      // From a subdirectory, the root must still be the repo top level
      const subDir = path.join(repoDir, 'src');
      fs.mkdirSync(subDir);
      process.chdir(subDir);

      const root = getGitRoot();
      assert.strictEqual(typeof root, 'string');
      assert.strictEqual(fs.existsSync(root), true);
      assert.strictEqual(path.resolve(root), repoDir);
    });
  });
});

describe('getGitRemoteUrl', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
  });

  it('returns null for non-git directory', () => {
    process.chdir(tempDir);
    assert.strictEqual(getGitRemoteUrl(), null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PYTHON DETECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('isValidPythonPath', () => {
  it('returns false for null', () => {
    assert.strictEqual(isValidPythonPath(null), false);
  });

  it('returns false for undefined', () => {
    assert.strictEqual(isValidPythonPath(undefined), false);
  });

  it('returns false for empty string', () => {
    assert.strictEqual(isValidPythonPath(''), false);
  });

  it('returns false for non-string', () => {
    assert.strictEqual(isValidPythonPath(123), false);
    assert.strictEqual(isValidPythonPath({}), false);
    assert.strictEqual(isValidPythonPath([]), false);
  });

  it('returns false for path with shell metacharacters', () => {
    assert.strictEqual(isValidPythonPath('/usr/bin/python; rm -rf /'), false);
    assert.strictEqual(isValidPythonPath('/usr/bin/python | cat'), false);
    assert.strictEqual(isValidPythonPath('/usr/bin/python`whoami`'), false);
    assert.strictEqual(isValidPythonPath('/usr/bin/python$(id)'), false);
    assert.strictEqual(isValidPythonPath('/usr/bin/python&'), false);
  });

  it('returns false for non-existent path', () => {
    assert.strictEqual(isValidPythonPath('/nonexistent/path/to/python'), false);
  });

  it('returns false for directory', () => {
    assert.strictEqual(isValidPythonPath(fs.realpathSync.native(os.tmpdir())), false);
  });

  it('returns true for a regular file with a clean path', () => {
    // A regular file with a clean path is what the validator accepts; no host Python needed
    const tempDir = createTempDir();
    try {
      const fakePython = path.join(tempDir, 'python3');
      fs.writeFileSync(fakePython, '#!/bin/sh\n');
      assert.strictEqual(isValidPythonPath(fakePython), true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe('getPythonPaths', () => {
  it('returns an array', () => {
    const paths = getPythonPaths();
    assert.strictEqual(Array.isArray(paths), true);
  });

  it('includes common Unix paths on non-Windows', () => {
    if (process.platform !== 'win32') {
      const paths = getPythonPaths();
      assert.ok(paths.includes('/usr/bin/python3'));
      assert.ok(paths.includes('/usr/local/bin/python3'));
    }
  });

  it('respects PYTHON_PATH environment variable', () => {
    const originalEnv = process.env.PYTHON_PATH;
    try {
      process.env.PYTHON_PATH = '/custom/python/path';
      const paths = getPythonPaths();
      assert.strictEqual(paths[0], '/custom/python/path');
    } finally {
      if (originalEnv !== undefined) {
        process.env.PYTHON_PATH = originalEnv;
      } else {
        delete process.env.PYTHON_PATH;
      }
    }
  });
});

describe('findPythonBinary', () => {
  it('returns a string or null', () => {
    const result = findPythonBinary();
    assert.strictEqual(result === null || typeof result === 'string', true);
  });

  it('returns valid path if Python is installed', () => {
    const result = findPythonBinary();
    if (result) {
      assert.strictEqual(isValidPythonPath(result), true);
    }
  });

  it('uses which/where for fast detection (performance)', () => {
    const start = Date.now();
    const result = findPythonBinary();
    const elapsed = Date.now() - start;

    // Should complete in under 1 second (fast path with which)
    // Previously could take 10+ seconds with timeout per path
    assert.ok(elapsed < 1000, `${elapsed}ms >= 1000ms`);

    if (result) {
      console.log(`Python detected at ${result} in ${elapsed}ms`);
    }
  });
});

describe('getPythonVersion', () => {
  it('returns a string or null', () => {
    const result = getPythonVersion();
    assert.strictEqual(result === null || typeof result === 'string', true);
  });

  it('returns version string starting with "Python" if available', () => {
    const result = getPythonVersion();
    if (result) {
      assert.match(result, /^Python \d+\.\d+/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DETECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('detectProjectType', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
  });

  it('returns config override if not "auto"', () => {
    assert.strictEqual(detectProjectType('monorepo'), 'monorepo');
    assert.strictEqual(detectProjectType('library'), 'library');
  });

  it('returns "auto" detection when override is "auto"', () => {
    // cwd is an empty temp dir, so no workspace/library markers exist
    const result = detectProjectType('auto');
    assert.strictEqual(result, 'single-repo');
  });

  it('detects monorepo from pnpm-workspace.yaml', () => {
    fs.writeFileSync('pnpm-workspace.yaml', 'packages:\n  - packages/*');
    assert.strictEqual(detectProjectType(), 'monorepo');
  });

  it('detects monorepo from lerna.json', () => {
    fs.writeFileSync('lerna.json', '{}');
    assert.strictEqual(detectProjectType(), 'monorepo');
  });

  it('detects monorepo from package.json workspaces', () => {
    fs.writeFileSync('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
    assert.strictEqual(detectProjectType(), 'monorepo');
  });

  it('detects library from package.json main/exports', () => {
    fs.writeFileSync('package.json', JSON.stringify({ main: 'index.js' }));
    assert.strictEqual(detectProjectType(), 'library');
  });

  it('returns single-repo as default', () => {
    assert.strictEqual(detectProjectType(), 'single-repo');
  });
});

describe('detectPackageManager', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
  });

  it('returns config override if not "auto"', () => {
    assert.strictEqual(detectPackageManager('yarn'), 'yarn');
    assert.strictEqual(detectPackageManager('pnpm'), 'pnpm');
  });

  it('detects bun from bun.lockb', () => {
    fs.writeFileSync('bun.lockb', '');
    assert.strictEqual(detectPackageManager(), 'bun');
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    fs.writeFileSync('pnpm-lock.yaml', '');
    assert.strictEqual(detectPackageManager(), 'pnpm');
  });

  it('detects yarn from yarn.lock', () => {
    fs.writeFileSync('yarn.lock', '');
    assert.strictEqual(detectPackageManager(), 'yarn');
  });

  it('detects npm from package-lock.json', () => {
    fs.writeFileSync('package-lock.json', '{}');
    assert.strictEqual(detectPackageManager(), 'npm');
  });

  it('returns null when no lock file found', () => {
    assert.strictEqual(detectPackageManager(), null);
  });

  it('bun takes precedence over others', () => {
    fs.writeFileSync('bun.lockb', '');
    fs.writeFileSync('package-lock.json', '{}');
    assert.strictEqual(detectPackageManager(), 'bun');
  });
});

describe('detectFramework', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tempDir);
  });

  it('returns config override if not "auto"', () => {
    assert.strictEqual(detectFramework('next'), 'next');
  });

  it('returns null when no package.json', () => {
    assert.strictEqual(detectFramework(), null);
  });

  it('detects Next.js', () => {
    fs.writeFileSync('package.json', JSON.stringify({ dependencies: { next: '^14.0.0' } }));
    assert.strictEqual(detectFramework(), 'next');
  });

  it('detects React', () => {
    fs.writeFileSync('package.json', JSON.stringify({ dependencies: { react: '^18.0.0' } }));
    assert.strictEqual(detectFramework(), 'react');
  });

  it('detects Vue', () => {
    fs.writeFileSync('package.json', JSON.stringify({ dependencies: { vue: '^3.0.0' } }));
    assert.strictEqual(detectFramework(), 'vue');
  });

  it('detects Astro', () => {
    fs.writeFileSync('package.json', JSON.stringify({ dependencies: { astro: '^4.0.0' } }));
    assert.strictEqual(detectFramework(), 'astro');
  });

  it('detects Express', () => {
    fs.writeFileSync('package.json', JSON.stringify({ dependencies: { express: '^4.0.0' } }));
    assert.strictEqual(detectFramework(), 'express');
  });

  it('Next.js takes precedence over React', () => {
    fs.writeFileSync('package.json', JSON.stringify({
      dependencies: { next: '^14.0.0', react: '^18.0.0' }
    }));
    assert.strictEqual(detectFramework(), 'next');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('execSafe', () => {
  it('returns output for successful command', () => {
    const result = execSafe('echo "hello"');
    assert.strictEqual(result, 'hello');
  });

  it('returns null for failed command', () => {
    const result = execSafe('nonexistent-command-12345');
    assert.strictEqual(result, null);
  });

  it('returns null on timeout', () => {
    // Command that would take longer than timeout
    const result = execSafe('sleep 10', 100);
    assert.strictEqual(result, null);
  });

  it('trims output', () => {
    const result = execSafe('echo "  hello  "');
    assert.strictEqual(result, 'hello');
  });

  it('handles newlines in output', () => {
    const result = execSafe('echo "line1\nline2"');
    assert.strictEqual(result, 'line1\nline2');
  });
});

describe('execFileSafe', () => {
  it('returns output for successful command', () => {
    const result = execFileSafe('echo', ['hello']);
    assert.strictEqual(result, 'hello');
  });

  it('returns null for non-existent binary', () => {
    const result = execFileSafe('/nonexistent/binary', ['arg']);
    assert.strictEqual(result, null);
  });

  it('returns null on timeout', () => {
    const result = execFileSafe('sleep', ['10'], 100);
    assert.strictEqual(result, null);
  });

  it('handles multiple arguments', () => {
    const result = execFileSafe('echo', ['hello', 'world']);
    assert.strictEqual(result, 'hello world');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASE TESTS (Issue #455)
// ═══════════════════════════════════════════════════════════════════════════

describe('Edge Cases (Issue #455)', () => {
  describe('Git detection edge cases', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = createTempDir();
    });

    afterEach(() => {
      cleanupTempDir(tempDir);
    });

    it('handles .git as file (worktree format)', () => {
      const worktreeDir = path.join(tempDir, 'worktree');
      createMockGitRepo(worktreeDir, { worktree: true });
      assert.strictEqual(isGitRepo(worktreeDir), true);
    });

    it('handles path traversal up to root without infinite loop', () => {
      // Deep directory should eventually reach root and terminate
      const deepPath = path.join(tempDir, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p');
      const result = isGitRepo(deepPath);
      assert.strictEqual(result, false);
    });

    it('handles special characters in path', () => {
      const specialDir = path.join(tempDir, 'dir with spaces');
      fs.mkdirSync(specialDir, { recursive: true });
      assert.doesNotThrow(() => isGitRepo(specialDir));
    });

    it('handles relative startDir without infinite loop', () => {
      // Child process: a regression hangs it for at most the timeout, not the whole suite
      const modulePath = require.resolve('../project-detector.cjs');
      const result = spawnSync(
        process.execPath,
        ['-e', 'console.log(require(process.argv[1]).isGitRepo("."))', modulePath],
        { cwd: tempDir, encoding: 'utf8', timeout: 5000 }
      );
      assert.strictEqual(result.error, undefined, `isGitRepo('.') did not terminate: ${result.error}`);
      assert.strictEqual(result.status, 0, result.stderr);
      assert.strictEqual(result.stdout.trim(), 'false');
    });

    it('getGitBranch returns null instead of throwing for non-git', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);
        assert.doesNotThrow(() => getGitBranch());
        assert.strictEqual(getGitBranch(), null);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('getGitRoot returns null instead of throwing for non-git', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);
        assert.doesNotThrow(() => getGitRoot());
        assert.strictEqual(getGitRoot(), null);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('getGitRemoteUrl returns null instead of throwing for non-git', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);
        assert.doesNotThrow(() => getGitRemoteUrl());
        assert.strictEqual(getGitRemoteUrl(), null);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Python detection edge cases', () => {
    it('handles missing which/where command gracefully', () => {
      // Even if which fails, should fall back to path checking
      assert.doesNotThrow(() => findPythonBinary());
    });

    it('which output with trailing newline is handled', () => {
      // execSafe trims output, so this should work
      const result = execSafe('which python3 2>/dev/null || echo ""');
      if (result) {
        assert.doesNotMatch(result, /\n$/);
      }
    });

    it('detection completes in reasonable time', () => {
      const start = Date.now();
      findPythonBinary();
      const elapsed = Date.now() - start;

      // Should complete in under 2 seconds even with all fallbacks
      assert.ok(elapsed < 2000, `${elapsed}ms >= 2000ms`);
    });
  });

  describe('Process.cwd() edge case', () => {
    it('isGitRepo handles invalid startDir gracefully', () => {
      // Pass a path that doesn't exist
      assert.doesNotThrow(() => isGitRepo('/this/path/definitely/does/not/exist'));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration Tests', () => {
  it('all git functions work together in actual git repo', { skip: SKIP_NO_GIT }, () => {
    const tempDir = createTempDir();
    try {
      const remoteUrl = 'https://example.com/acme/widgets.git';
      withRealGitRepo(tempDir, { branch: 'main', remoteUrl }, (repoDir) => {
        assert.strictEqual(isGitRepo(), true);
        assert.strictEqual(getGitBranch(), 'main');
        assert.strictEqual(path.resolve(getGitRoot()), repoDir);
        assert.strictEqual(getGitRemoteUrl(), remoteUrl);
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('all git functions return null in non-git directory', () => {
    const tempDir = createTempDir();
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);

      assert.strictEqual(isGitRepo(), false);
      assert.strictEqual(getGitBranch(), null);
      assert.strictEqual(getGitRoot(), null);
      assert.strictEqual(getGitRemoteUrl(), null);
    } finally {
      process.chdir(originalCwd);
      cleanupTempDir(tempDir);
    }
  });

  it('Python detection chain works end-to-end', () => {
    const binary = findPythonBinary();
    const version = getPythonVersion();

    // If binary found, version should also be found
    if (binary) {
      assert.ok(version);
      assert.match(version, /Python/i);
    }
  });
});
