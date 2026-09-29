/**
 * Shared utilities for ClaudeKit hooks
 *
 * Contains config loading, path sanitization, and common constants
 * used by session-init.cjs and dev-rules-reminder.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCAL_CONFIG_PATH = '.claude/config/adf-config.json';
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.claude', 'config', 'adf-config.json');

// Legacy export for backward compatibility
const CONFIG_PATH = LOCAL_CONFIG_PATH;

const DEFAULT_CONFIG = {
  plan: {
    namingFormat: '{date}-{issue}-{slug}',
    dateFormat: 'YYMMDD-HHmm',
    issuePrefix: null,
    reportsDir: 'reports',
    resolution: {
      // CHANGED: Removed 'mostRecent' - only explicit session state activates plans
      // Branch matching resolves as 'branch' (gets reports) not 'session' (active)
      order: ['session', 'branch'],
      branchPattern: '(?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)'
    },
    validation: {
      mode: 'prompt',  // 'auto' | 'prompt' | 'off'
      minQuestions: 3,
      maxQuestions: 8,
      focusAreas: ['assumptions', 'risks', 'tradeoffs', 'architecture']
    }
  },
  paths: {
    docs: 'docs',
    plans: 'plans'
  },
  docs: {
    maxLoc: 800,  // Maximum lines of code per doc file before warning
    codeLevelOnly: false  // cmc profile: generate only code-level docs (codebase-summary, code-standards); defer arch/PRD/FSD/use-cases to the company docs/ tree
  },
  locale: {
    thinkingLanguage: null,  // Language for reasoning (e.g., "en" for precision)
    responseLanguage: null   // Language for user-facing output (e.g., "vi")
  },
  trust: {
    passphrase: null,
    enabled: false
  },
  project: {
    type: 'auto',
    packageManager: 'auto',
    framework: 'auto'
  },
  skills: {
    research: {
      useGemini: true  // Toggle Gemini CLI usage in research skill
    }
  },
  assertions: [],
  statusline: 'full',
  hooks: {
    'session-init': true,
    'subagent-init': true,
    'dev-rules-reminder': true,
    'usage-context-awareness': true,
    'context-tracking': true,
    'scout-block': true,
    'privacy-block': true,
    'post-edit-simplify-reminder': true,
    'task-completed-handler': true,
    'teammate-idle-handler': true
  }
};

/**
 * Deep merge objects (source values override target, nested objects merged recursively)
 * Arrays are replaced entirely (not concatenated) to avoid duplicate entries
 *
 * IMPORTANT: Empty objects {} are treated as "inherit from parent", not "replace with empty".
 * This allows global config to set hooks.foo: false and have it persist even when
 * local config has hooks: {} (empty = inherit, not reset to defaults).
 *
 * @param {Object} target - Base object
 * @param {Object} source - Object to merge (takes precedence)
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    // Arrays: replace entirely (don't concatenate)
    if (Array.isArray(sourceVal)) {
      result[key] = [...sourceVal];
    }
    // Objects: recurse (but not null)
    // SKIP empty objects - treat {} as "inherit from parent"
    else if (sourceVal !== null && typeof sourceVal === 'object' && !Array.isArray(sourceVal)) {
      // Empty object = inherit (don't override parent values)
      if (Object.keys(sourceVal).length === 0) {
        // Keep target value unchanged - empty source means "no override"
        continue;
      }
      result[key] = deepMerge(targetVal || {}, sourceVal);
    }
    // Primitives: source wins
    else {
      result[key] = sourceVal;
    }
  }
  return result;
}

/**
 * Load config from a specific file path
 * @param {string} configPath - Path to config file
 * @returns {Object|null} Parsed config or null if not found/invalid
 */
function loadConfigFromPath(configPath) {
  try {
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Get session temp file path
 * @param {string} sessionId - Session identifier
 * @returns {string} Path to session temp file
 */
function getSessionTempPath(sessionId) {
  return path.join(os.tmpdir(), `ck-session-${sessionId}.json`);
}

/**
 * Read session state from temp file
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session state or null
 */
function readSessionState(sessionId) {
  if (!sessionId) return null;
  const tempPath = getSessionTempPath(sessionId);
  try {
    if (!fs.existsSync(tempPath)) return null;
    return JSON.parse(fs.readFileSync(tempPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Write session state atomically to temp file
 * @param {string} sessionId - Session identifier
 * @param {Object} state - State object to persist
 * @returns {boolean} Success status
 */
function writeSessionState(sessionId, state) {
  if (!sessionId) return false;
  const tempPath = getSessionTempPath(sessionId);
  const tmpFile = tempPath + '.' + Math.random().toString(36).slice(2);
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
    fs.renameSync(tmpFile, tempPath);
    return true;
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
    return false;
  }
}

/**
 * Characters invalid in filenames across Windows, macOS, Linux
 * Windows: < > : " / \ | ? *
 * macOS/Linux: / and null byte
 * Also includes control characters and other problematic chars
 */
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f\x7f]/g;

/**
 * Sanitize slug for safe filesystem usage
 * - Removes invalid filename characters
 * - Replaces non-alphanumeric (except hyphen) with hyphen
 * - Collapses multiple hyphens
 * - Removes leading/trailing hyphens
 * - Limits length to prevent filesystem issues
 *
 * @param {string} slug - Slug to sanitize
 * @returns {string} Sanitized slug (empty string if nothing valid remains)
 */
function sanitizeSlug(slug) {
  if (!slug || typeof slug !== 'string') return '';

  let sanitized = slug
    // Remove invalid filename chars first
    .replace(INVALID_FILENAME_CHARS, '')
    // Replace any non-alphanumeric (except hyphen) with hyphen
    .replace(/[^a-z0-9-]/gi, '-')
    // Collapse multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length (most filesystems support 255, but keep reasonable)
    .slice(0, 100);

  return sanitized;
}

/**
 * Extract feature slug from git branch name
 * Pattern: (?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)
 * @param {string} branch - Git branch name
 * @param {string} pattern - Regex pattern (optional)
 * @returns {string|null} Extracted slug or null
 */
function extractSlugFromBranch(branch, pattern) {
  if (!branch) return null;
  const defaultPattern = /(?:feat|fix|chore|refactor|docs)\/(?:[^\/]+\/)?(.+)/;
  const regex = pattern ? new RegExp(pattern) : defaultPattern;
  const match = branch.match(regex);
  return match ? sanitizeSlug(match[1]) : null;
}

/**
 * Find most recent plan folder by timestamp prefix
 * @param {string} plansDir - Plans directory path
 * @returns {string|null} Most recent plan path or null
 */
function findMostRecentPlan(plansDir) {
  try {
    if (!fs.existsSync(plansDir)) return null;
    const entries = fs.readdirSync(plansDir, { withFileTypes: true });
    const planDirs = entries
      .filter(e => e.isDirectory() && /^\d{6}/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();
    return planDirs.length > 0 ? path.join(plansDir, planDirs[0]) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Default timeout for git commands (5 seconds)
 * Prevents indefinite hangs on network mounts or corrupted repos
 */
const DEFAULT_EXEC_TIMEOUT_MS = 5000;

/**
 * Safely execute shell command (internal helper)
 * SECURITY: Only accepts whitelisted git read commands
 * @param {string} cmd - Command to execute
 * @param {Object} options - Execution options
 * @param {string} options.cwd - Working directory (optional)
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @returns {string|null} Command output or null
 */
function execSafe(cmd, options = {}) {
  // Whitelist of safe read-only commands
  const allowedCommands = [
    'git branch --show-current',
    'git rev-parse --abbrev-ref HEAD',
    'git rev-parse --show-toplevel',
    'git rev-parse --show-toplevel --git-dir --git-common-dir'
  ];
  if (!allowedCommands.includes(cmd)) {
    return null;
  }

  const { cwd = undefined, timeout = DEFAULT_EXEC_TIMEOUT_MS } = options;

  try {
    return require('child_process')
      .execSync(cmd, {
        encoding: 'utf8',
        timeout,
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      .trim();
  } catch (e) {
    return null;
  }
}

/**
 * Report types accepted in report filenames: {type}-{name-pattern}.md
 * Single source of truth for the Naming section injected by session/prompt/codex hooks.
 */
const REPORT_TYPES = Object.freeze([
  'researcher',
  'brainstormer',
  'scout',
  'planner',
  'tester',
  'debugger',
  'code-reviewer',
  'docs-manager',
  'project-manager',
  'audit',
  'fullstack-developer',
  'ui-ux-designer',
  'business-analyst',
  'testcase-writer'
]);

/** cwd -> resolved plans base dir (see resolvePlansBaseDir) */
const plansBaseDirCache = new Map();

/**
 * Directory that plans/ (and non-plan reports) resolve against.
 *
 * plans/ is gitignored, so a copy inside each linked git worktree is lost with the
 * worktree and diverges from the main one. In a linked worktree this maps cwd onto the
 * main worktree (same relative subdirectory); everywhere else cwd is returned unchanged
 * (normal repo, subdirectory of a repo - Issue #327, non-git dir, git error, bare repo).
 * docs/ is committed per branch and must keep resolving against cwd, not this.
 *
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {string} Base directory for plans/
 */
function resolvePlansBaseDir(cwd = process.cwd()) {
  // Hooks are short-lived processes, so a per-process memo cannot go stale in practice
  // and saves a git spawn each time several code paths ask for the same cwd.
  if (!plansBaseDirCache.has(cwd)) plansBaseDirCache.set(cwd, computePlansBaseDir(cwd));
  return plansBaseDirCache.get(cwd);
}

/** Uncached worker for resolvePlansBaseDir */
function computePlansBaseDir(cwd) {
  const out = execSafe('git rev-parse --show-toplevel --git-dir --git-common-dir', { cwd });
  if (!out) return cwd;
  const [toplevel, gitDir, commonDir] = out.split('\n').map(line => line.trim());
  if (!toplevel || !gitDir || !commonDir) return cwd;

  try {
    // git may print --git-dir / --git-common-dir relative to cwd (and inconsistently so),
    // so resolve both against the real cwd before comparing.
    const realCwd = fs.realpathSync(cwd);
    const absGitDir = path.resolve(realCwd, gitDir);
    const absCommonDir = path.resolve(realCwd, commonDir);
    // Same dir = main worktree. Only a plain <root>/.git common dir has a main root.
    if (absGitDir === absCommonDir || path.basename(absCommonDir) !== '.git') return cwd;
    return path.join(path.dirname(absCommonDir), path.relative(toplevel, realCwd));
  } catch (e) {
    return cwd;
  }
}

/**
 * Directories under plans/ that are never plan dirs (report buckets, archive, templates, visuals).
 * A branch named fix/reports must not adopt plans/reports as its plan. Shared with tidy-plans.
 */
const RESERVED_PLAN_DIRS = Object.freeze(['reports', 'archive', 'templates', 'visuals']);

/**
 * Find the plan dir a branch slug refers to: a non-reserved dir holding a plan.md whose name
 * is the slug or ends with '-<slug>' (plan names are {date}-{issue}-{slug}). Latest wins.
 * @param {string} plansRoot - Absolute plans directory
 * @param {string} slug - Slug extracted from the branch name
 * @returns {string|null} Plan dir name or null
 */
function findBranchPlanName(plansRoot, slug) {
  const names = fs.readdirSync(plansRoot, { withFileTypes: true })
    .filter(e => e.isDirectory()
      && !RESERVED_PLAN_DIRS.includes(e.name)
      && (e.name === slug || e.name.endsWith(`-${slug}`))
      && fs.existsSync(path.join(plansRoot, e.name, 'plan.md')))
    .map(e => e.name)
    .sort();
  return names.length > 0 ? names[names.length - 1] : null;
}

/**
 * Resolve active plan path using cascading resolution with tracking
 *
 * Resolution semantics:
 * - 'session': Explicitly set via set-active-plan.cjs → ACTIVE (directive). Skipped when the
 *   plan dir no longer exists (archived/deleted), so nothing keeps routing into a ghost dir.
 * - 'branch': Matched from git branch name → the plan for this branch; it receives reports
 *   but is never persisted as the session's activePlan
 * - 'mostRecent': REMOVED - was causing stale plan pollution
 *
 * @param {string} sessionId - Session identifier (optional)
 * @param {Object} config - ClaudeKit config
 * @param {string} [cwd] - Directory whose branch and plans/ are matched (default: process.cwd()). In a linked
 *   git worktree plans/ is looked up in the main worktree and the returned path is absolute.
 * @returns {{ path: string|null, resolvedBy: 'session'|'branch'|null }} Resolution result with tracking
 */
function resolvePlanPath(sessionId, config, cwd) {
  const workDir = cwd || process.cwd();
  const plansDir = config?.paths?.plans || 'plans';
  const resolution = config?.plan?.resolution || {};
  const order = resolution.order || ['session', 'branch'];
  const branchPattern = resolution.branchPattern;

  for (const method of order) {
    switch (method) {
      case 'session': {
        const state = readSessionState(sessionId);
        if (state?.activePlan) {
          // Issue #335: Handle both absolute and relative paths
          // - Absolute paths (from updated set-active-plan.cjs): use as-is
          // - Relative paths (legacy): resolve using sessionOrigin if available
          let resolvedPath = state.activePlan;
          if (!path.isAbsolute(resolvedPath) && state.sessionOrigin) {
            // Resolve relative path using session origin directory
            resolvedPath = path.join(state.sessionOrigin, resolvedPath);
          }
          // Dir gone (cook archived it, or it was deleted): fall through to the next method
          if (fs.existsSync(resolvedPath)) {
            return { path: resolvedPath, resolvedBy: 'session' };
          }
        }
        break;
      }
      case 'branch': {
        try {
          const branch = execSafe('git branch --show-current', { cwd: workDir });
          const slug = extractSlugFromBranch(branch, branchPattern);
          if (slug) {
            const plansBase = resolvePlansBaseDir(workDir);
            const plansRootAbs = path.resolve(plansBase, plansDir);
            // Relative plansDir stays relative when it resolves against cwd itself; only a
            // linked worktree (plans/ lives in the main worktree) needs an absolute path.
            const plansRoot = plansBase === workDir ? plansDir : plansRootAbs;
            const planName = fs.existsSync(plansRootAbs) ? findBranchPlanName(plansRootAbs, slug) : null;
            if (planName) {
              return { path: path.join(plansRoot, planName), resolvedBy: 'branch' };
            }
          }
        } catch (e) {
          // Ignore errors reading plans dir
        }
        break;
      }
      // NOTE: 'mostRecent' case intentionally removed - was causing stale plan pollution
    }
  }
  return { path: null, resolvedBy: null };
}

/**
 * Plan explicitly activated for a session (set-active-plan), ignoring branch matching.
 * Null when there is no session, no active plan, or its dir no longer exists.
 * Shared by the statusline and cook-after-plan-reminder so none of them show an archived plan.
 *
 * @param {string|null} sessionId - Session identifier
 * @returns {string|null} Absolute (or legacy relative) plan dir, or null
 */
function resolveSessionPlanPath(sessionId) {
  return resolvePlanPath(sessionId, { plan: { resolution: { order: ['session'] } } }).path;
}

/**
 * Normalize path value (trim, remove trailing slashes, handle empty)
 * @param {string} pathValue - Path to normalize
 * @returns {string|null} Normalized path or null if invalid
 */
function normalizePath(pathValue) {
  if (!pathValue || typeof pathValue !== 'string') return null;

  // Trim whitespace
  let normalized = pathValue.trim();

  // Empty after trim = invalid
  if (!normalized) return null;

  // Remove trailing slashes (but keep root "/" or "C:\")
  normalized = normalized.replace(/[/\\]+$/, '');

  // If it became empty (was just slashes), return null
  if (!normalized) return null;

  return normalized;
}

/**
 * Check if path is absolute
 * @param {string} pathValue - Path to check
 * @returns {boolean} True if absolute path
 */
function isAbsolutePath(pathValue) {
  if (!pathValue) return false;
  // Unix absolute: starts with /
  // Windows absolute: starts with drive letter (C:\) or UNC (\\)
  return path.isAbsolute(pathValue);
}

/**
 * Sanitize path values
 * - Normalizes path (trim, remove trailing slashes)
 * - Allows absolute paths (for consolidated plans use case)
 * - Prevents obvious security issues (null bytes, etc.)
 *
 * @param {string} pathValue - Path to sanitize
 * @param {string} projectRoot - Project root for relative path resolution
 * @returns {string|null} Sanitized path or null if invalid
 */
function sanitizePath(pathValue, projectRoot) {
  // Normalize first
  const normalized = normalizePath(pathValue);
  if (!normalized) return null;

  // Block null bytes and other dangerous chars
  if (/[\x00]/.test(normalized)) return null;

  // Allow absolute paths (user explicitly wants consolidated plans elsewhere)
  if (isAbsolutePath(normalized)) {
    return normalized;
  }

  // For relative paths, resolve and validate
  const resolved = path.resolve(projectRoot, normalized);

  // Prevent path traversal outside project (../ attacks)
  // But allow if user explicitly set absolute path
  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    // This is a relative path trying to escape - block it
    return null;
  }

  return normalized;
}

/**
 * Validate and sanitize config paths
 */
function sanitizeConfig(config, projectRoot) {
  const result = { ...config };

  if (result.plan) {
    result.plan = { ...result.plan };
    if (!sanitizePath(result.plan.reportsDir, projectRoot)) {
      result.plan.reportsDir = DEFAULT_CONFIG.plan.reportsDir;
    }
    // Merge resolution defaults
    result.plan.resolution = {
      ...DEFAULT_CONFIG.plan.resolution,
      ...result.plan.resolution
    };
    // Merge validation defaults
    result.plan.validation = {
      ...DEFAULT_CONFIG.plan.validation,
      ...result.plan.validation
    };
  }

  if (result.paths) {
    result.paths = { ...result.paths };
    if (!sanitizePath(result.paths.docs, projectRoot)) {
      result.paths.docs = DEFAULT_CONFIG.paths.docs;
    }
    if (!sanitizePath(result.paths.plans, projectRoot)) {
      result.paths.plans = DEFAULT_CONFIG.paths.plans;
    }
  }

  if (result.locale) {
    result.locale = { ...result.locale };
  }

  return result;
}

/**
 * Load config with cascading resolution: DEFAULT → global → local
 *
 * Resolution order (each layer overrides the previous):
 *   1. DEFAULT_CONFIG (hardcoded defaults)
 *   2. Global config (~/.claude/config/adf-config.json) - user preferences
 *   3. Local config (./.claude/config/adf-config.json) - project-specific overrides
 *
 * @param {Object} options - Options for config loading
 * @param {boolean} options.includeProject - Include project section (default: true)
 * @param {boolean} options.includeAssertions - Include assertions (default: true)
 * @param {boolean} options.includeLocale - Include locale section (default: true)
 */
function loadConfig(options = {}) {
  const { includeProject = true, includeAssertions = true, includeLocale = true } = options;
  const projectRoot = process.cwd();

  // Load configs from both locations
  const globalConfig = loadConfigFromPath(GLOBAL_CONFIG_PATH);
  const localConfig = loadConfigFromPath(LOCAL_CONFIG_PATH);

  // No config files found - use defaults
  if (!globalConfig && !localConfig) {
    return getDefaultConfig(includeProject, includeAssertions, includeLocale);
  }

  try {
    // Deep merge: DEFAULT → global → local (local wins)
    let merged = deepMerge({}, DEFAULT_CONFIG);
    if (globalConfig) merged = deepMerge(merged, globalConfig);
    if (localConfig) merged = deepMerge(merged, localConfig);

    // Build result with optional sections
    const result = {
      plan: merged.plan || DEFAULT_CONFIG.plan,
      paths: merged.paths || DEFAULT_CONFIG.paths,
      docs: merged.docs || DEFAULT_CONFIG.docs
    };

    if (includeLocale) {
      result.locale = merged.locale || DEFAULT_CONFIG.locale;
    }
    // Always include trust config for verification
    result.trust = merged.trust || DEFAULT_CONFIG.trust;
    if (includeProject) {
      result.project = merged.project || DEFAULT_CONFIG.project;
    }
    if (includeAssertions) {
      result.assertions = merged.assertions || [];
    }
    // Skills configuration
    result.skills = merged.skills || DEFAULT_CONFIG.skills;
    // Hooks configuration
    result.hooks = merged.hooks || DEFAULT_CONFIG.hooks;
    // Statusline mode
    result.statusline = merged.statusline || 'full';

    return sanitizeConfig(result, projectRoot);
  } catch (e) {
    return getDefaultConfig(includeProject, includeAssertions, includeLocale);
  }
}

/**
 * Get default config with optional sections
 */
function getDefaultConfig(includeProject = true, includeAssertions = true, includeLocale = true) {
  const result = {
    plan: { ...DEFAULT_CONFIG.plan },
    paths: { ...DEFAULT_CONFIG.paths },
    docs: { ...DEFAULT_CONFIG.docs },
    skills: { ...DEFAULT_CONFIG.skills },
    hooks: { ...DEFAULT_CONFIG.hooks },
    statusline: 'full'
  };
  if (includeLocale) {
    result.locale = { ...DEFAULT_CONFIG.locale };
  }
  if (includeProject) {
    result.project = { ...DEFAULT_CONFIG.project };
  }
  if (includeAssertions) {
    result.assertions = [];
  }
  return result;
}

/**
 * Escape shell special characters for env file values
 * Handles: backslash, double quote, dollar sign, backtick
 */
function escapeShellValue(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\\/g, '\\\\')   // Backslash first
    .replace(/"/g, '\\"')     // Double quotes
    .replace(/\$/g, '\\$')    // Dollar sign
    .replace(/`/g, '\\`');    // Backticks (command substitution)
}

/**
 * Write environment variable to CLAUDE_ENV_FILE (with escaping)
 */
function writeEnv(envFile, key, value) {
  if (envFile && value !== null && value !== undefined) {
    const escaped = escapeShellValue(String(value));
    fs.appendFileSync(envFile, `export ${key}="${escaped}"\n`);
  }
}

/**
 * Get reports path based on plan resolution
 * - 'session' (active) and 'branch' (branch-matched) plans -> {plan}/reports
 * - otherwise -> {plans}/reports/{YYMM} (month bucket, keeps unplanned reports out of one flat dir)
 *
 * @param {string|null} planPath - The plan path
 * @param {string|null} resolvedBy - How plan was resolved ('session'|'branch'|null)
 * @param {Object} planConfig - Plan configuration
 * @param {Object} pathsConfig - Paths configuration
 * @param {string|null} baseDir - Optional base directory for absolute path resolution
 * @returns {string} Reports path (absolute if baseDir provided, relative otherwise)
 */
function getReportsPath(planPath, resolvedBy, planConfig, pathsConfig, baseDir = null) {
  const reportsDir = normalizePath(planConfig?.reportsDir) || 'reports';
  const plansDir = normalizePath(pathsConfig?.plans) || 'plans';

  let reportPath;
  // Issue #327: Validate normalized path to prevent whitespace-only paths creating invalid directories
  const hasPlan = resolvedBy === 'session' || resolvedBy === 'branch';
  const normalizedPlanPath = planPath && hasPlan ? normalizePath(planPath) : null;
  if (normalizedPlanPath) {
    reportPath = `${normalizedPlanPath}/${reportsDir}`;
  } else {
    reportPath = `${plansDir}/${reportsDir}/${formatDate('YYMM')}`;
  }

  // Return absolute path if baseDir provided.
  // resolve, not join: an active plan path is stored absolute (set-active-plan.cjs, Issue
  // #335), and join would treat it as a segment — '/a/b' + '/a/b/c' = '/a/b/a/b/c'.
  if (baseDir) {
    return path.resolve(baseDir, reportPath);
  }
  return reportPath + '/';
}

/**
 * Reports directory right now, resolved from live state (session file, branch, plans on disk)
 * rather than the CK_REPORTS_PATH env var captured at session start. That value goes stale when
 * a plan is archived mid-session, and writing to it recreates the archived plan dir.
 * Plan dirs are checked for existence during resolution, so the result never sits under a
 * missing plan dir.
 *
 * @param {string|null} sessionId - Session identifier
 * @param {string} [cwd=process.cwd()] - Working directory (plans base is derived from it)
 * @returns {string} Absolute reports path (no trailing slash)
 */
function resolveCurrentReportsPath(sessionId, cwd = process.cwd()) {
  const config = loadConfig({ includeProject: false, includeAssertions: false, includeLocale: false });
  const resolved = resolvePlanPath(sessionId, config, cwd);
  return getReportsPath(resolved.path, resolved.resolvedBy, config.plan, config.paths, resolvePlansBaseDir(cwd));
}

/**
 * Format issue ID with prefix
 */
function formatIssueId(issueId, planConfig) {
  if (!issueId) return null;
  return planConfig.issuePrefix ? `${planConfig.issuePrefix}${issueId}` : `#${issueId}`;
}

/**
 * Extract issue ID from branch name
 */
function extractIssueFromBranch(branch) {
  if (!branch) return null;
  const patterns = [
    /(?:issue|gh|fix|feat|bug)[/-]?(\d+)/i,
    /[/-](\d+)[/-]/,
    /#(\d+)/
  ];
  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Format date according to dateFormat config
 * Supports: YYMMDD, YYMMDD-HHmm, YYYYMMDD, etc.
 * @param {string} format - Date format string
 * @returns {string} Formatted date
 */
function formatDate(format) {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const tokens = {
    'YYYY': now.getFullYear(),
    'YY': String(now.getFullYear()).slice(-2),
    'MM': pad(now.getMonth() + 1),
    'DD': pad(now.getDate()),
    'HH': pad(now.getHours()),
    'mm': pad(now.getMinutes()),
    'ss': pad(now.getSeconds())
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(token, value);
  }
  return result;
}

/**
 * Validate naming pattern result
 * Ensures pattern resolves to a usable directory name
 *
 * @param {string} pattern - Resolved naming pattern
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
function validateNamingPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'Pattern is empty or not a string' };
  }

  // After removing {slug} placeholder, should still have content
  const withoutSlug = pattern.replace(/\{slug\}/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!withoutSlug) {
    return { valid: false, error: 'Pattern resolves to empty after removing {slug}' };
  }

  // Check for remaining unresolved placeholders (besides {slug})
  const unresolvedMatch = withoutSlug.match(/\{[^}]+\}/);
  if (unresolvedMatch) {
    return { valid: false, error: `Unresolved placeholder: ${unresolvedMatch[0]}` };
  }

  // Pattern must contain {slug} for agents to substitute
  if (!pattern.includes('{slug}')) {
    return { valid: false, error: 'Pattern must contain {slug} placeholder' };
  }

  return { valid: true };
}

/**
 * Resolve naming pattern with date and optional issue prefix
 * Keeps {slug} as placeholder for agents to substitute
 *
 * Example: namingFormat="{date}-{issue}-{slug}", dateFormat="YYMMDD-HHmm", issue="GH-88"
 * Returns: "251212-1830-GH-88-{slug}" (if issue exists)
 * Returns: "251212-1830-{slug}" (if no issue)
 *
 * @param {Object} planConfig - Plan configuration
 * @param {string|null} gitBranch - Current git branch (for issue extraction)
 * @returns {string} Resolved naming pattern with {slug} placeholder
 */
function resolveNamingPattern(planConfig, gitBranch) {
  const { namingFormat, dateFormat, issuePrefix } = planConfig;
  const formattedDate = formatDate(dateFormat);

  // Try to extract issue ID from branch name
  const issueId = extractIssueFromBranch(gitBranch);
  const fullIssue = issueId && issuePrefix ? `${issuePrefix}${issueId}` : null;

  // Build pattern by substituting {date} and {issue}, keep {slug}
  let pattern = namingFormat;
  pattern = pattern.replace('{date}', formattedDate);

  if (fullIssue) {
    pattern = pattern.replace('{issue}', fullIssue);
  } else {
    // Remove {issue} and any trailing/leading dash
    pattern = pattern.replace(/-?\{issue\}-?/, '-').replace(/--+/g, '-');
  }

  // Clean up the result:
  // - Remove leading/trailing hyphens
  // - Collapse multiple hyphens (except around {slug})
  pattern = pattern
    .replace(/^-+/, '')           // Remove leading hyphens
    .replace(/-+$/, '')           // Remove trailing hyphens
    .replace(/-+(\{slug\})/g, '-$1')  // Single hyphen before {slug}
    .replace(/(\{slug\})-+/g, '$1-')  // Single hyphen after {slug}
    .replace(/--+/g, '-');        // Collapse other multiple hyphens

  // Validate the resulting pattern
  const validation = validateNamingPattern(pattern);
  if (!validation.valid) {
    // Log warning but return pattern anyway (fail-safe)
    if (process.env.CK_DEBUG) {
      console.error(`[adf-config] Warning: ${validation.error}`);
    }
  }

  return pattern;
}

/**
 * Get current git branch (safe execution)
 * @param {string|null} cwd - Working directory to run git command from (optional)
 * @returns {string|null} Current branch name or null
 */
function getGitBranch(cwd = null) {
  return execSafe('git branch --show-current', { cwd: cwd || undefined });
}

/**
 * Get git repository root directory
 * @param {string|null} cwd - Working directory to run git command from (optional)
 * @returns {string|null} Git root absolute path or null if not in git repo
 */
function getGitRoot(cwd = null) {
  return execSafe('git rev-parse --show-toplevel', { cwd: cwd || undefined });
}

/**
 * Extract task list ID from plan resolution for Claude Code Tasks coordination
 * Only returns ID for session-resolved plans (explicitly active, not branch-matched)
 *
 * Cross-platform: path.basename() handles both Unix/Windows separators
 *
 * @param {{ path: string|null, resolvedBy: 'session'|'branch'|null }} resolved - Plan resolution result
 * @returns {string|null} Task list ID (plan directory name) or null
 */
function extractTaskListId(resolved) {
  if (!resolved || resolved.resolvedBy !== 'session' || !resolved.path) {
    return null;
  }
  return path.basename(resolved.path);
}

/**
 * Check if a hook is enabled in config
 * Returns true if hook is not defined (default enabled)
 *
 * @param {string} hookName - Hook name (script basename without .cjs)
 * @returns {boolean} Whether hook is enabled
 */
function isHookEnabled(hookName) {
  const config = loadConfig({ includeProject: false, includeAssertions: false, includeLocale: false });
  const hooks = config.hooks || {};
  // Return true if undefined (default enabled), otherwise return the boolean value
  return hooks[hookName] !== false;
}

module.exports = {
  CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  GLOBAL_CONFIG_PATH,
  DEFAULT_CONFIG,
  INVALID_FILENAME_CHARS,
  deepMerge,
  loadConfigFromPath,
  loadConfig,
  normalizePath,
  isAbsolutePath,
  sanitizePath,
  sanitizeSlug,
  sanitizeConfig,
  escapeShellValue,
  writeEnv,
  getSessionTempPath,
  readSessionState,
  writeSessionState,
  REPORT_TYPES,
  RESERVED_PLAN_DIRS,
  resolvePlansBaseDir,
  resolvePlanPath,
  resolveSessionPlanPath,
  resolveCurrentReportsPath,
  extractSlugFromBranch,
  findMostRecentPlan,
  getReportsPath,
  formatIssueId,
  extractIssueFromBranch,
  formatDate,
  validateNamingPattern,
  resolveNamingPattern,
  getGitBranch,
  getGitRoot,
  extractTaskListId,
  isHookEnabled
};
