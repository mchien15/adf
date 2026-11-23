#!/usr/bin/env node
/**
 * context-builder.cjs - Context/reminder building for session injection
 *
 * Extracted from dev-rules-reminder.cjs for reuse in Claude hooks.
 * Builds paths, plan context and naming sections.
 *
 * @module context-builder
 */

const fs = require('fs');
const path = require('path');

// Distinctive text emitted in every reminder; wasRecentlyInjected() looks for it in the transcript
const REMINDER_MARKER = 'Replace `{slug}` in pattern with:';
const {
  loadConfig,
  resolvePlanPath,
  resolvePlansBaseDir,
  getReportsPath,
  getGitBranch,
  resolveNamingPattern,
  normalizePath,
  REPORT_TYPES
} = require('./ck-config-utils.cjs');

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build plan context from config and git info
 * @param {string|null} sessionId - Session ID
 * @param {Object} config - Loaded config
 * @param {string} [cwd] - Directory to read the git branch and match plans from (default: process.cwd())
 * @returns {Object} Plan context object
 */
function buildPlanContext(sessionId, config, cwd) {
  const { plan, paths } = config;
  const gitBranch = getGitBranch(cwd);
  const resolved = resolvePlanPath(sessionId, config, cwd);
  const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, plan, paths);

  // Compute naming pattern directly for reliable injection
  const namePattern = resolveNamingPattern(plan, gitBranch);

  const planLine = resolved.resolvedBy === 'session'
    ? `- Plan: ${resolved.path}`
    : resolved.resolvedBy === 'branch'
      ? `- Plan: ${resolved.path} (matched from branch)`
      : `- Plan: none`;

  // Validation config (injected so LLM can reference it)
  const validation = plan.validation || {};
  const validationMode = validation.mode || 'prompt';
  const validationMin = validation.minQuestions || 3;
  const validationMax = validation.maxQuestions || 8;

  return { reportsPath, gitBranch, planLine, namePattern, validationMode, validationMin, validationMax };
}

/**
 * Check if context was recently injected (prevent duplicate injection)
 * @param {string} transcriptPath - Path to transcript file
 * @returns {boolean} true if recently injected
 */
function wasRecentlyInjected(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return false;
    const transcript = fs.readFileSync(transcriptPath, 'utf-8');
    // Check last 150 lines (hook output is ~30 lines, so this covers ~5 user prompts)
    return transcript.split('\n').slice(-150).some(line => line.includes(REMINDER_MARKER));
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build paths section
 * @param {Object} params
 * @param {string} params.reportsPath - Reports path
 * @param {string} params.plansPath - Plans path
 * @param {string} params.docsPath - Docs path
 * @param {number} [params.docsMaxLoc=800] - Max lines of code for docs
 * @returns {string[]} Lines for paths section
 */
function buildPathsSection({ reportsPath, plansPath, docsPath, docsMaxLoc = 800, docsCodeLevelOnly = false }) {
  const lines = [
    `## Paths`,
    `Reports: ${reportsPath} | Plans: ${plansPath}/ | Docs: ${docsPath}/ | docs.maxLoc: ${docsMaxLoc}`,
  ];
  if (docsCodeLevelOnly) {
    lines.push(`- **Docs mode: code-level only (cmc profile)** — generate ONLY \`codebase-summary.md\`, \`code-standards.md\`, and \`documentation-index.md\` in the Docs path. Do NOT (re)generate architecture, PRD/overview, FSD, or use-cases — the company \`docs/\` tree owns those; cross-link to them from the index instead.`);
  }
  lines.push(``);
  return lines;
}

/**
 * Build plan context section
 * @param {Object} params
 * @param {string} params.planLine - Plan status line
 * @param {string} params.reportsPath - Reports path
 * @param {string} [params.gitBranch] - Git branch
 * @param {string} params.validationMode - Validation mode
 * @param {number} params.validationMin - Min questions
 * @param {number} params.validationMax - Max questions
 * @returns {string[]} Lines for plan context section
 */
function buildPlanContextSection({ planLine, reportsPath, gitBranch, validationMode, validationMin, validationMax }) {
  const lines = [
    `## Plan Context`,
    planLine,
    `- Reports: ${reportsPath}`
  ];

  if (gitBranch) {
    lines.push(`- Branch: ${gitBranch}`);
  }

  lines.push(`- Validation: mode=${validationMode}, questions=${validationMin}-${validationMax}`);
  lines.push(``);

  return lines;
}

/**
 * Build naming section
 * @param {Object} params
 * @param {string} params.reportsPath - Reports path
 * @param {string} params.plansPath - Plans path
 * @param {string} params.namePattern - Naming pattern
 * @returns {string[]} Lines for naming section
 */
function buildNamingSection({ reportsPath, plansPath, namePattern }) {
  return [
    `## Naming`,
    `- Report: \`${reportsPath}{type}-${namePattern}.md\``,
    `- Plan dir: \`${plansPath}/${namePattern}/\``,
    `- Replace \`{type}\` with one of: ${REPORT_TYPES.join(', ')}`,
    `- ${REMINDER_MARKER} short-kebab-slug (2–4 plain words)`
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build full reminder content from all sections
 * @param {Object} params - All parameters for building reminder
 * @returns {string[]} Array of lines
 */
function buildReminder(params) {
  const {
    reportsPath,
    plansPath,
    docsPath,
    docsMaxLoc,
    docsCodeLevelOnly,
    planLine,
    gitBranch,
    namePattern,
    validationMode,
    validationMin,
    validationMax
  } = params;

  return [
    ...buildPathsSection({ reportsPath, plansPath, docsPath, docsMaxLoc, docsCodeLevelOnly }),
    ...buildPlanContextSection({ planLine, reportsPath, gitBranch, validationMode, validationMin, validationMax }),
    ...buildNamingSection({ reportsPath, plansPath, namePattern })
  ];
}

/**
 * Build complete reminder context (unified entry point for plugins)
 *
 * @param {Object} [params]
 * @param {string} [params.sessionId] - Session ID
 * @param {Object} [params.config] - CK config (auto-loaded if not provided)
 * @param {string} [params.baseDir] - Base directory for absolute path resolution (Issue #327)
 * @returns {{
 *   content: string,
 *   lines: string[],
 *   sections: Object
 * }}
 */
function buildReminderContext({ sessionId, config, baseDir } = {}) {
  // Load config if not provided
  const cfg = config || loadConfig();

  // Build plan context
  const cwd = baseDir || process.cwd();
  const planCtx = buildPlanContext(sessionId, cfg, cwd);

  // Issue #327: Use baseDir for absolute path resolution (subdirectory workflow support)
  // If baseDir provided, resolve paths as absolute; otherwise use relative paths.
  // plans/ and non-plan reports live in the main git worktree (plansBase differs from cwd
  // only inside a linked worktree, where relative paths would point at a lost copy), so
  // that case is always absolute. docs/ stays with cwd: it is committed per branch.
  const plansBase = resolvePlansBaseDir(cwd);
  const plansAbsolute = Boolean(baseDir) || plansBase !== cwd;
  const effectiveBaseDir = baseDir || null;
  const plansPathRel = normalizePath(cfg.paths?.plans) || 'plans';
  const docsPathRel = normalizePath(cfg.paths?.docs) || 'docs';
  // getReportsPath returns a trailing slash when it builds the relative form, and
  // buildNamingSection concatenates a filename straight onto reportsPath. path.resolve
  // strips trailing slashes, so restore one to keep that concatenation well-formed.
  const withTrailingSlash = (p) => (p.endsWith('/') ? p : `${p}/`);

  // Build all parameters with absolute paths if baseDir provided
  const params = {
    sessionId,
    // resolve, not join: reportsPath carries an absolute active-plan path (Issue #335) and
    // paths.* may be configured absolute — join would append them and double the prefix.
    reportsPath: plansAbsolute
      ? withTrailingSlash(path.resolve(plansBase, planCtx.reportsPath))
      : planCtx.reportsPath,
    plansPath: plansAbsolute ? path.resolve(plansBase, plansPathRel) : plansPathRel,
    docsPath: effectiveBaseDir ? path.resolve(effectiveBaseDir, docsPathRel) : docsPathRel,
    docsMaxLoc: Math.max(1, parseInt(cfg.docs?.maxLoc, 10) || 800),
    docsCodeLevelOnly: cfg.docs?.codeLevelOnly === true,
    planLine: planCtx.planLine,
    gitBranch: planCtx.gitBranch,
    namePattern: planCtx.namePattern,
    validationMode: planCtx.validationMode,
    validationMin: planCtx.validationMin,
    validationMax: planCtx.validationMax
  };

  const lines = buildReminder(params);

  return {
    content: lines.join('\n'),
    lines,
    sections: {
      paths: buildPathsSection({ reportsPath: params.reportsPath, plansPath: params.plansPath, docsPath: params.docsPath, docsMaxLoc: params.docsMaxLoc, docsCodeLevelOnly: params.docsCodeLevelOnly }),
      planContext: buildPlanContextSection(planCtx),
      naming: buildNamingSection({ reportsPath: params.reportsPath, plansPath: params.plansPath, namePattern: params.namePattern })
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  buildReminderContext,
  buildReminder,
  buildPathsSection,
  buildPlanContextSection,
  buildNamingSection,
  buildPlanContext,
  wasRecentlyInjected
};
