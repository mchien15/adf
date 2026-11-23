#!/usr/bin/env node
/**
 * SessionStart Hook - Initializes session environment
 *
 * Fires: Once per session (startup, resume, clear, compact)
 * Purpose: Load config, persist to env vars, output context
 *
 * Exit Codes:
 *   0 - Success (non-blocking, allows continuation)
 */

// Crash wrapper
try {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const {
    loadConfig,
    writeEnv,
    writeSessionState,
    resolvePlanPath,
    resolvePlansBaseDir,
    getReportsPath,
    resolveNamingPattern,
    extractTaskListId,
    getGitBranch,
    getGitRoot,
    isHookEnabled
  } = require('./lib/ck-config-utils.cjs');

  // Early exit if hook disabled in config
  if (!isHookEnabled('session-init')) {
    process.exit(0);
  }

/**
 * Main hook execution
 */
async function main() {
  try {
    const stdin = fs.readFileSync(0, 'utf-8').trim();
    const data = stdin ? JSON.parse(stdin) : {};
    const envFile = process.env.CLAUDE_ENV_FILE;
    const source = data.source || 'unknown';
    const sessionId = data.session_id || null;

    const config = loadConfig();

    // Resolve plan - now returns { path, resolvedBy }
    const resolved = resolvePlanPath(null, config);

    // CRITICAL FIX: Only persist explicitly-set plans to session state as activePlan
    // Branch-matched plans are stored separately (suggestedPlan), never as activePlan
    // This prevents stale plan pollution on fresh sessions
    if (sessionId) {
      writeSessionState(sessionId, {
        sessionOrigin: process.cwd(),
        // Only session-resolved plans are truly "active"
        activePlan: resolved.resolvedBy === 'session' ? resolved.path : null,
        // Branch-matched plan, tracked apart from activePlan (it still receives reports below)
        suggestedPlan: resolved.resolvedBy === 'branch' ? resolved.path : null,
        timestamp: Date.now(),
        source
      });
    }

    // Reports go to the resolved plan's reports/ (session or branch-matched), else the month bucket
    const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, config.plan, config.paths);

    // Extract task list ID for Claude Code Tasks coordination (shared helper)
    const taskListId = extractTaskListId(resolved);

    // Collect static environment info (computed once per session)
    const staticEnv = {
      nodeVersion: process.version,
      osPlatform: process.platform,
      gitBranch: getGitBranch(),
      gitRoot: getGitRoot(),
      user: process.env.USERNAME || process.env.USER || process.env.LOGNAME || os.userInfo().username,
      locale: process.env.LANG || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      claudeSettingsDir: path.resolve(__dirname, '..')
    };

    // Compute base directory for absolute paths (Issue #327: use CWD for subdirectory support)
    // Git root is kept in staticEnv for reference, but CWD determines where files are created
    const baseDir = process.cwd();
    // plans/ and non-plan reports live once per repo: in a linked git worktree they resolve
    // against the main worktree (plans are gitignored, a per-worktree copy is lost and diverges).
    // docs/ is committed per branch, so it keeps resolving against baseDir.
    const plansBase = resolvePlansBaseDir(baseDir);

    // Compute resolved naming pattern (date + issue resolved, {slug} kept as placeholder)
    const namePattern = resolveNamingPattern(config.plan, staticEnv.gitBranch);

    if (envFile) {
      // Session & plan config
      writeEnv(envFile, 'CK_SESSION_ID', sessionId || '');
      writeEnv(envFile, 'CK_PLAN_NAMING_FORMAT', config.plan.namingFormat);
      writeEnv(envFile, 'CK_PLAN_DATE_FORMAT', config.plan.dateFormat);
      writeEnv(envFile, 'CK_PLAN_ISSUE_PREFIX', config.plan.issuePrefix || '');
      writeEnv(envFile, 'CK_PLAN_REPORTS_DIR', config.plan.reportsDir);

      // NEW: Resolved naming pattern for DRY file naming in agents
      // Example: "251212-1830-GH-88-{slug}" or "251212-1830-{slug}"
      // Agents use: `{agent-type}-$CK_NAME_PATTERN.md` and substitute {slug}
      writeEnv(envFile, 'CK_NAME_PATTERN', namePattern);

      // Plan resolution
      writeEnv(envFile, 'CK_ACTIVE_PLAN', resolved.resolvedBy === 'session' ? resolved.path : '');
      writeEnv(envFile, 'CK_SUGGESTED_PLAN', resolved.resolvedBy === 'branch' ? resolved.path : '');

      // Claude Code Tasks integration - enables multi-session/subagent coordination
      // Task list ID = plan directory name (shared across all sessions working on same plan)
      if (taskListId) {
        writeEnv(envFile, 'CLAUDE_CODE_TASK_LIST_ID', taskListId);
      }

      // Paths - use absolute paths based on CWD for subdirectory workflow support (Issue #327)
      // resolve, not join: these values may already be absolute (active plan path from
      // set-active-plan.cjs, or an absolute paths.* in config). join would append them to
      // baseDir and double the prefix.
      writeEnv(envFile, 'CK_GIT_ROOT', staticEnv.gitRoot || '');
      writeEnv(envFile, 'CK_REPORTS_PATH', path.resolve(plansBase, reportsPath));
      writeEnv(envFile, 'CK_DOCS_PATH', path.resolve(baseDir, config.paths.docs));
      writeEnv(envFile, 'CK_PLANS_PATH', path.resolve(plansBase, config.paths.plans));
      writeEnv(envFile, 'CK_PROJECT_ROOT', process.cwd());

      // NEW: Static environment info (so other hooks don't need to recompute)
      writeEnv(envFile, 'CK_NODE_VERSION', staticEnv.nodeVersion);
      writeEnv(envFile, 'CK_OS_PLATFORM', staticEnv.osPlatform);
      writeEnv(envFile, 'CK_GIT_BRANCH', staticEnv.gitBranch || '');
      writeEnv(envFile, 'CK_USER', staticEnv.user);
      writeEnv(envFile, 'CK_LOCALE', staticEnv.locale);
      writeEnv(envFile, 'CK_TIMEZONE', staticEnv.timezone);
      writeEnv(envFile, 'CK_CLAUDE_SETTINGS_DIR', staticEnv.claudeSettingsDir);

      // Locale config
      if (config.locale?.thinkingLanguage) {
        writeEnv(envFile, 'CK_THINKING_LANGUAGE', config.locale.thinkingLanguage);
      }
      if (config.locale?.responseLanguage) {
        writeEnv(envFile, 'CK_RESPONSE_LANGUAGE', config.locale.responseLanguage);
      }

      // Plan validation config (for /plan validate, /plan --hard, /plan --parallel)
      const validation = config.plan?.validation || {};
      writeEnv(envFile, 'CK_VALIDATION_MODE', validation.mode || 'prompt');
      writeEnv(envFile, 'CK_VALIDATION_MIN_QUESTIONS', validation.minQuestions || 3);
      writeEnv(envFile, 'CK_VALIDATION_MAX_QUESTIONS', validation.maxQuestions || 8);
      writeEnv(envFile, 'CK_VALIDATION_FOCUS_AREAS', (validation.focusAreas || ['assumptions', 'risks', 'tradeoffs', 'architecture']).join(','));


    }

    const summary = [`Plan naming: ${config.plan.namingFormat}`];
    if (resolved.path) {
      summary.push(`Plan: ${resolved.path}${resolved.resolvedBy === 'session' ? '' : ' (matched from branch)'}`);
    }
    console.log(`Session ${source}. ${summary.join(' | ')}`);

    // Info: Show git root when running from subdirectory (Issue #327: now supported)
    if (staticEnv.gitRoot && staticEnv.gitRoot !== process.cwd()) {
      console.log(`📁 Subdirectory mode: Plans/docs will be created in current directory`);
      console.log(`   Git root: ${staticEnv.gitRoot}`);
    }

    // MITIGATION: Issue #277 - Auto-compact can bypass AskUserQuestion approval gates
    // When context is compacted mid-workflow, the summarization may lose "pending approval" state.
    // This warning reminds Claude to verify if user approval was pending before proceeding.
    // Upstream bug: Claude Code CLI should preserve pending interactive state during compaction.
    if (source === 'compact') {
      console.log(`\n⚠️ CONTEXT COMPACTED - APPROVAL STATE CHECK:`);
      console.log(`If you were waiting for user approval via AskUserQuestion (e.g., Step 4 review gate),`);
      console.log(`you MUST re-confirm with the user before proceeding. Do NOT assume approval was given.`);
      console.log(`Use AskUserQuestion to verify: "Context was compacted. Please confirm approval to continue."`);
    }


    process.exit(0);
  } catch (error) {
    console.error(`SessionStart hook error: ${error.message}`);
    process.exit(0);
  }
  }

  main();
} catch (e) {
  // Minimal crash logging (zero deps — only Node builtins)
  try {
    const fs = require('fs');
    const p = require('path');
    const logDir = p.join(__dirname, '.logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(p.join(logDir, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: p.basename(__filename, '.cjs'), status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0); // fail-open
}
